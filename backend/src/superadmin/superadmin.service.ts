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
    // Attach live access state + patient counts.
    const out = [] as any[];
    for (const t of tenants) {
      const access = this.subs.computeAccess(t.subscription);
      const patients = await this.prisma.patient.count({ where: { tenantId: t.id } });
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
        data: { status: 'ACTIVE', currentPeriodEnd: newEnd },
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
        data: { status: 'ACTIVE', currentPeriodEnd: newEnd },
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
