import { Injectable, OnModuleInit, UnauthorizedException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { runInTenant } from '../tenant/tenant-context';
import { GrantDaysDto, CreateTenantAdminDto, ResetUserDto } from './dto';
import { DEFAULT_PROCEDURES } from '../auth/default-procedures';

const DAY = 86_400_000;

@Injectable()
export class SuperAdminService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private subs: SubscriptionService,
  ) {}

  // Bootstrap the first platform operator from env (idempotent).
  async onModuleInit() {
    const u = process.env.SUPERADMIN_USERNAME;
    const p = process.env.SUPERADMIN_PASSWORD;
    if (!u || !p) return;
    const existing = await this.prisma.superAdmin.findUnique({ where: { username: u } });
    if (existing) return;
    await this.prisma.superAdmin.create({
      data: { username: u, passwordHash: await bcrypt.hash(p, 10), fullName: 'Platform Admin' },
    });
    // eslint-disable-next-line no-console
    console.log(`Super-admin "${u}" created from env.`);
  }

  async login(username: string, password: string) {
    const admin = await this.prisma.superAdmin.findUnique({ where: { username } });
    if (!admin || !admin.isActive) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    const token = await this.jwt.signAsync({ sub: admin.id, username: admin.username, superAdmin: true, role: 'SUPERADMIN' });
    return { access_token: token, admin: { id: admin.id, username: admin.username, fullName: admin.fullName } };
  }

  // --- Tenant management (all queries run in super-admin context → unscoped) ---
  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subscription: true, _count: { select: { users: true } } },
    });
    // Attach live access state + patient counts + latest payment so the operator can
    // tell apart a fresh signup (no payment), a payment awaiting review, and a rejected one
    // — instead of all three looking identical as "PENDING".
    const out = [] as any[];
    for (const t of tenants) {
      const access = this.subs.computeAccess(t.subscription);
      const patients = await this.prisma.patient.count({ where: { tenantId: t.id } });
      const lastPay = await this.prisma.subscriptionPayment.findFirst({
        where: { tenantId: t.id },
        orderBy: { submittedAt: 'desc' },
        select: { status: true, amount: true, trxId: true, submittedAt: true },
      });
      out.push({
        id: t.id,
        slug: t.slug,
        name: t.name,
        ownerName: t.ownerName,
        phone: t.phone,
        email: t.email,
        isActive: t.isActive,
        createdAt: t.createdAt,
        users: t._count.users,
        patients,
        pendingPayment: lastPay?.status === 'SUBMITTED',
        lastPaymentStatus: lastPay?.status ?? null,
        lastPaymentAmount: lastPay?.amount ?? null,
        subscription: t.subscription
          ? { status: access.status, active: access.active, currentPeriodEnd: t.subscription.currentPeriodEnd, daysLeft: access.daysLeft, amount: t.subscription.amount }
          : null,
      });
    }
    return out;
  }

  async metrics() {
    const tenants = await this.prisma.tenant.findMany({ include: { subscription: true } });
    let active = 0;
    let mrr = 0;
    for (const t of tenants) {
      const a = this.subs.computeAccess(t.subscription);
      if (a.active) { active++; mrr += t.subscription?.amount ?? 0; }
    }
    return { tenants: tenants.length, activeTenants: active, mrr };
  }

  // Business + abuse analytics for the platform operator.
  async analytics() {
    const tenants = await this.prisma.tenant.findMany({ include: { subscription: true } });
    const now = Date.now();
    let active = 0, pending = 0, suspended = 0, mrr = 0;
    for (const t of tenants) {
      if (!t.isActive) { suspended++; continue; }
      const a = this.subs.computeAccess(t.subscription);
      if (a.active) { active++; mrr += t.subscription?.amount ?? 0; } else pending++;
    }

    // Revenue = verified real payments (manual grants have amount 0 so they don't inflate it).
    const verified = await this.prisma.subscriptionPayment.findMany({
      where: { status: 'VERIFIED' }, select: { amount: true, verifiedAt: true, tenantId: true },
    });
    const revenueTotal = verified.reduce((s, p) => s + p.amount, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const revenueThisMonth = verified
      .filter((p) => p.verifiedAt && p.verifiedAt >= monthStart)
      .reduce((s, p) => s + p.amount, 0);

    // Signups per day, last 14 days.
    const days: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.date, d]));
    tenants.forEach((t) => { const e = dayMap.get(t.createdAt.toISOString().slice(0, 10)); if (e) e.count++; });

    // --- Abuse / spam signals ---
    const paidTenantIds = new Set(verified.map((p) => p.tenantId));
    // clinics that signed up > 48h ago, still active, never paid → likely dead/spam
    const neverActivated = tenants.filter(
      (t) => t.isActive && !paidTenantIds.has(t.id) && now - t.createdAt.getTime() > 48 * 3600 * 1000,
    ).length;
    // same IP used by 2+ signups
    const ipCount = new Map<string, number>();
    tenants.forEach((t) => { if (t.signupIp) ipCount.set(t.signupIp, (ipCount.get(t.signupIp) || 0) + 1); });
    const duplicateIps = [...ipCount.entries()].filter(([, c]) => c >= 2).map(([ip, count]) => ({ ip, count })).sort((a, b) => b.count - a.count);
    // signups in the last hour (burst detection)
    const lastHour = tenants.filter((t) => now - t.createdAt.getTime() < 3600 * 1000).length;

    // Top clinics by patient volume.
    const withCounts: { name: string; slug: string; patients: number }[] = [];
    for (const t of tenants) {
      const patients = await this.prisma.patient.count({ where: { tenantId: t.id } });
      withCounts.push({ name: t.name, slug: t.slug, patients });
    }
    withCounts.sort((a, b) => b.patients - a.patients);

    const recentSignups = [...tenants]
      .sort((a, b) => +b.createdAt - +a.createdAt)
      .slice(0, 12)
      .map((t) => ({
        name: t.name, slug: t.slug, phone: t.phone, signupIp: t.signupIp,
        isActive: t.isActive, createdAt: t.createdAt,
        status: this.subs.computeAccess(t.subscription).status,
      }));

    // --- Landing-page traffic (how engaged visitors are) ---
    const traffic = await this.traffic();

    // --- Suspicious: one IP tied to multiple clinics (signup + login) ---
    const suspicious = await this.suspicious(tenants);

    return {
      totals: { tenants: tenants.length, active, pending, suspended },
      mrr, revenueTotal, revenueThisMonth,
      signups: days,
      spam: { neverActivated, duplicateIps, lastHour },
      suspicious,
      topClinics: withCounts.slice(0, 5),
      recentSignups,
      traffic,
    };
  }

  // Suspicious-IP report: an IP that touched 2+ different clinics — via signup or login —
  // is the strongest multi-account / shared-credential signal. Returns the clinics per IP.
  private async suspicious(tenants: { id: string; name: string; slug: string; signupIp: string | null }[]) {
    const byIp = new Map<string, Map<string, { name: string; slug: string; via: Set<string> }>>();
    const add = (ip: string | null | undefined, tid: string, name: string, slug: string, via: string) => {
      if (!ip) return;
      if (!byIp.has(ip)) byIp.set(ip, new Map());
      const clinics = byIp.get(ip)!;
      if (!clinics.has(tid)) clinics.set(tid, { name, slug, via: new Set() });
      clinics.get(tid)!.via.add(via);
    };

    // signup IPs
    tenants.forEach((t) => add(t.signupIp, t.id, t.name, t.slug, 'signup'));

    // login IPs (last 30 days)
    const since = new Date(Date.now() - 30 * DAY);
    const logins = await this.prisma.loginLog.findMany({
      where: { createdAt: { gte: since } },
      select: { ip: true, tenantId: true, clinicName: true },
    });
    const slugById = new Map(tenants.map((t) => [t.id, t.slug]));
    // Only count clinics that still exist — ignore orphan login rows from deleted clinics.
    logins.forEach((l) => { if (l.tenantId && slugById.has(l.tenantId)) add(l.ip, l.tenantId, l.clinicName || '—', slugById.get(l.tenantId)!, 'login'); });

    const sharedIps = [...byIp.entries()]
      .filter(([, clinics]) => clinics.size >= 2)
      .map(([ip, clinics]) => ({
        ip,
        count: clinics.size,
        clinics: [...clinics.values()].map((c) => ({ name: c.name, slug: c.slug, via: [...c.via].join('+') })),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { sharedIps };
  }

  // Landing-page engagement over the last 30 days: how long people stay and how far
  // down they read. Only counts "real" visits (>=2s) so bots/instant bounces don't skew
  // the averages; bounces are reported separately.
  private async traffic() {
    const since = new Date(Date.now() - 30 * DAY);
    const visits = await this.prisma.visitSession.findMany({
      where: { createdAt: { gte: since } },
      select: { durationMs: true, maxScroll: true, device: true, signedUp: true, utmSource: true, createdAt: true },
    });

    const total = visits.length;
    const real = visits.filter((v) => v.durationMs >= 2000);
    const bounces = total - real.length; // left in under 2s
    const n = real.length || 1;

    const avgTimeSec = Math.round(real.reduce((s, v) => s + v.durationMs, 0) / n / 1000);
    const avgScroll = Math.round(real.reduce((s, v) => s + v.maxScroll, 0) / n);
    const signups = visits.filter((v) => v.signedUp).length;
    const conversionRate = total ? Math.round((signups / total) * 1000) / 10 : 0; // % 1dp

    // Scroll-depth buckets — how much of the page people actually read.
    const buckets = [
      { label: '0–25%', min: 0, max: 25, count: 0 },
      { label: '25–50%', min: 25, max: 50, count: 0 },
      { label: '50–75%', min: 50, max: 75, count: 0 },
      { label: '75–100%', min: 75, max: 101, count: 0 },
    ];
    real.forEach((v) => {
      const b = buckets.find((x) => v.maxScroll >= x.min && v.maxScroll < x.max);
      if (b) b.count++;
    });

    // Time-on-page distribution.
    const timeBuckets = [
      { label: '<10s', min: 0, max: 10, count: 0 },
      { label: '10–30s', min: 10, max: 30, count: 0 },
      { label: '30–60s', min: 30, max: 60, count: 0 },
      { label: '1–3m', min: 60, max: 180, count: 0 },
      { label: '3m+', min: 180, max: Infinity, count: 0 },
    ];
    real.forEach((v) => {
      const s = v.durationMs / 1000;
      const b = timeBuckets.find((x) => s >= x.min && s < x.max);
      if (b) b.count++;
    });

    const mobile = real.filter((v) => v.device === 'mobile').length;
    const desktop = real.length - mobile;

    // Visits per day, last 14 days. Keyed in UTC on both sides so the bucket dates
    // line up with createdAt.toISOString() regardless of the server's local timezone.
    const days: { date: string; count: number }[] = [];
    const todayUtc = new Date(); todayUtc.setUTCHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayUtc.getTime() - i * DAY);
      days.push({ date: d.toISOString().slice(0, 10), count: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.date, d]));
    visits.forEach((v) => { const e = dayMap.get(v.createdAt.toISOString().slice(0, 10)); if (e) e.count++; });

    const fromAds = visits.filter((v) => v.utmSource).length;

    return {
      total, real: real.length, bounces,
      avgTimeSec, avgScroll,
      signups, conversionRate,
      fromAds,
      device: { mobile, desktop },
      scrollBuckets: buckets.map((b) => ({ label: b.label, count: b.count })),
      timeBuckets: timeBuckets.map((b) => ({ label: b.label, count: b.count })),
      visitsByDay: days,
    };
  }

  async pendingPayments() {
    const pays = await this.prisma.subscriptionPayment.findMany({
      where: { status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
    });
    // decorate with tenant info
    const out = [] as any[];
    for (const p of pays) {
      const t = await this.prisma.tenant.findFirst({ where: { subscription: { id: p.subscriptionId } } });
      out.push({ ...p, tenant: t ? { id: t.id, name: t.name, slug: t.slug } : null });
    }
    return out;
  }

  // Platform errors + failed logins/signups (written by the global ErrorLogFilter),
  // paginated because the log can grow large.
  async errorLogs(skip = 0, take = 25) {
    const safeTake = Math.min(Math.max(take, 1), 100);
    const safeSkip = Math.max(skip, 0);
    const [rows, total] = await Promise.all([
      this.prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, skip: safeSkip, take: safeTake }),
      this.prisma.errorLog.count(),
    ]);
    // Attach clinic name where we know the tenant.
    const tids = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))] as string[];
    const tenants = tids.length
      ? await this.prisma.tenant.findMany({ where: { id: { in: tids } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(tenants.map((t) => [t.id, t.name]));
    return {
      rows: rows.map((r) => ({ ...r, clinicName: r.tenantId ? nameById.get(r.tenantId) || null : null })),
      total,
      skip: safeSkip,
      take: safeTake,
    };
  }

  // --- Tenant users (support desk) ---
  async listTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, phone: true, username: true, fullName: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Reset a user's login credentials (phone and/or password) — for support requests.
  async resetUser(userId: string, dto: ResetUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const data: any = {};
    if (dto.phone) {
      const phone = dto.phone.trim();
      const clash = await this.prisma.user.findUnique({ where: { phone } });
      if (clash && clash.id !== userId) throw new ConflictException('That phone number is already in use');
      data.phone = phone;
    }
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to update');
    await this.prisma.user.update({ where: { id: userId }, data });
    return { reset: true };
  }

  private extend(currentPeriodEnd: Date | null, days: number): Date {
    const now = Date.now();
    const base = currentPeriodEnd && currentPeriodEnd.getTime() > now ? currentPeriodEnd.getTime() : now;
    return new Date(base + days * DAY);
  }

  async verifyPayment(paymentId: string, adminId: string) {
    const pay = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new NotFoundException('Payment not found');
    if (pay.status !== 'SUBMITTED') throw new BadRequestException('Payment already processed');

    const sub = await this.prisma.subscription.findUnique({ where: { id: pay.subscriptionId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    const newEnd = this.extend(sub.currentPeriodEnd, pay.periodDays);
    await this.prisma.$transaction([
      this.prisma.subscriptionPayment.update({
        where: { id: pay.id },
        data: { status: 'VERIFIED', verifiedAt: new Date(), verifiedBy: adminId },
      }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        // paid → leave the trial, become a real STANDARD subscription
        data: { status: 'ACTIVE', currentPeriodEnd: newEnd, plan: 'STANDARD' },
      }),
    ]);
    return { verified: true, currentPeriodEnd: newEnd };
  }

  async rejectPayment(paymentId: string, adminId: string) {
    const pay = await this.prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
    if (!pay) throw new NotFoundException('Payment not found');
    await this.prisma.subscriptionPayment.update({
      where: { id: pay.id },
      data: { status: 'REJECTED', verifiedAt: new Date(), verifiedBy: adminId },
    });
    return { rejected: true };
  }

  // Manual grant of N days (free trial / comp access), any number of days.
  async grantDays(dto: GrantDaysDto, adminId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId: dto.tenantId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const newEnd = this.extend(sub.currentPeriodEnd, dto.days);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        // operator-granted access is no longer a trial (comp, but not the auto free trial)
        data: { status: 'ACTIVE', currentPeriodEnd: newEnd, plan: 'STANDARD' },
      }),
      this.prisma.subscriptionPayment.create({
        data: {
          subscriptionId: sub.id,
          tenantId: dto.tenantId,
          amount: 0,
          method: 'MANUAL_GRANT',
          status: 'VERIFIED',
          periodDays: dto.days,
          note: dto.note || `Manual grant of ${dto.days} days`,
          verifiedAt: new Date(),
          verifiedBy: adminId,
        },
      }),
      // reactivate the clinic account in case it was suspended
      this.prisma.tenant.update({ where: { id: dto.tenantId }, data: { isActive: true } }),
    ]);
    return { granted: true, currentPeriodEnd: newEnd };
  }

  async suspendTenant(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { isActive: false } });
    await this.prisma.subscription.updateMany({ where: { tenantId }, data: { status: 'SUSPENDED' } });
    return { suspended: true };
  }

  // Permanently delete a clinic and ALL of its data (test/spam cleanup). Irreversible.
  // Deletes child rows before parents to respect foreign keys; everything is filtered by
  // tenantId (super-admin context bypasses the auto tenant scope, so the filter is explicit).
  async deleteTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Clinic not found');
    const p = this.prisma;
    const w = { where: { tenantId } };
    await this.prisma.$transaction([
      p.payment.deleteMany(w),
      p.invoiceItem.deleteMany(w),
      p.invoice.deleteMany(w),
      p.prescriptionItem.deleteMany(w),
      p.prescription.deleteMany(w),
      p.treatmentItem.deleteMany(w),
      p.treatmentRecord.deleteMany(w),
      p.treatmentPlan.deleteMany(w),
      p.toothRecord.deleteMany(w),
      p.perioRecord.deleteMany(w),
      p.clinicalNote.deleteMany(w),
      p.medicalHistory.deleteMany(w),
      p.patientFile.deleteMany(w),
      p.appointment.deleteMany(w),
      p.patient.deleteMany(w),
      p.procedure.deleteMany(w),
      p.clinicSettings.deleteMany(w),
      p.auditLog.deleteMany(w),
      p.subscriptionPayment.deleteMany(w),
      p.subscription.deleteMany(w),
      p.loginLog.deleteMany(w),
      p.user.deleteMany(w),
      p.tenant.delete({ where: { id: tenantId } }),
    ]);
    return { deleted: true, name: tenant.name };
  }

  async activateTenant(tenantId: string) {
    await this.prisma.tenant.update({ where: { id: tenantId }, data: { isActive: true } });
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (sub) {
      const access = this.subs.computeAccess(sub);
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: access.currentPeriodEnd && access.active ? 'ACTIVE' : 'PENDING' },
      });
    }
    return { activated: true };
  }

  // Provision a clinic directly from the console (no self-signup).
  async createTenant(dto: CreateTenantAdminDto) {
    const slug = (dto.clinicCode || dto.clinicName)
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (slug.length < 2) throw new BadRequestException('Clinic code too short');
    const taken = await this.prisma.tenant.findUnique({ where: { slug } });
    if (taken) throw new ConflictException('Clinic code already taken');

    const tenant = await this.prisma.tenant.create({
      data: { slug, name: dto.clinicName, ownerName: dto.ownerName, phone: dto.phone },
    });
    const price = Number(process.env.SUBSCRIPTION_PRICE) || 990;
    await runInTenant(tenant.id, async () => {
      await this.prisma.user.create({
        data: {
          phone: dto.phone.trim(),
          username: dto.username ?? dto.ownerName,
          passwordHash: await bcrypt.hash(dto.password, 10),
          fullName: dto.ownerName,
          role: 'OWNER',
          isActive: true,
        },
      });
      await this.prisma.subscription.create({ data: { plan: 'STANDARD', status: 'PENDING', amount: price, currentPeriodEnd: null } });
      await this.prisma.clinicSettings.create({ data: { name: dto.clinicName, phone: dto.phone } });
      await this.prisma.procedure.createMany({ data: DEFAULT_PROCEDURES });
    });
    return { id: tenant.id, slug: tenant.slug, name: tenant.name };
  }
}
