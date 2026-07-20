import { Injectable, UnauthorizedException, BadRequestException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { runInTenant } from '../tenant/tenant-context';
import { SignupDto } from './dto';
import { DEFAULT_PROCEDURES } from './default-procedures';
import { clinicSuspended } from './suspended';
import { MetaService } from '../meta/meta.service';

// Simple in-memory per-IP signup throttle (anti-spam). No external dep needed.
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SIGNUP_MAX_PER_IP = 5; // max clinic signups per IP per hour
const signupHits = new Map<string, number[]>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private meta: MetaService,
  ) {}

  private throttleSignup(ip: string) {
    if (!ip) return;
    const now = Date.now();
    const hits = (signupHits.get(ip) || []).filter((t) => now - t < SIGNUP_WINDOW_MS);
    if (hits.length >= SIGNUP_MAX_PER_IP) {
      throw new HttpException('অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    signupHits.set(ip, hits);
  }

  // --- Tenant login: (phone, password) -----------------------------------
  async login(phone: string, password: string) {
    // Phone is globally unique → resolves the user (and thus the clinic) directly.
    // No tenant context here (public route); the Prisma extension leaves this query unscoped.
    const user = await this.prisma.user.findUnique({ where: { phone: phone.trim() } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid phone or password');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant) throw new UnauthorizedException('Invalid phone or password');
    if (!tenant.isActive) throw clinicSuspended();

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid phone or password');

    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
      tenantId: tenant.id,
    });

    return { access_token: token, user: this.shape(user), tenant: this.tenantShape(tenant) };
  }

  // --- Tenant signup: create clinic + owner + pending subscription -------
  async signup(dto: SignupDto, ip = '', ua = '') {
    this.throttleSignup(ip); // anti-spam: cap signups per IP per hour
    const phone = dto.phone.trim();
    // Phone is the login id — must be unique across the whole platform.
    const phoneTaken = await this.prisma.user.findUnique({ where: { phone } });
    if (phoneTaken) throw new ConflictException('This phone number already has an account. Please log in.');

    // Internal slug (not used at login) — auto-generate a unique one from the clinic name.
    const base = dto.clinicName
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'clinic';
    let slug = base;
    for (let i = 1; await this.prisma.tenant.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

    const tenant = await this.prisma.tenant.create({
      data: {
        slug, name: dto.clinicName, ownerName: dto.ownerName, phone, email: dto.email,
        signupIp: ip || null,
        // Meta attribution — replayed later on the offline purchase.
        fbp: dto.fbp || null, fbc: dto.fbc || null, signupUa: ua || null,
      },
    });

    const price = Number(process.env.SUBSCRIPTION_PRICE) || 990;

    await runInTenant(tenant.id, async () => {
      await this.prisma.user.create({
        data: {
          phone,
          username: dto.ownerName,
          passwordHash: await bcrypt.hash(dto.password, 10),
          fullName: dto.ownerName,
          role: 'OWNER',
          isActive: true,
        },
      });
      // New clinics start PENDING — no access until a payment is verified or the admin grants days.
      await this.prisma.subscription.create({
        data: { plan: 'STANDARD', status: 'PENDING', amount: price, currentPeriodEnd: null },
      });
      await this.prisma.clinicSettings.create({
        data: { name: dto.clinicName, phone },
      });
      // Give the clinic a starter procedure list to edit (drug catalog is global/shared).
      await this.prisma.procedure.createMany({ data: DEFAULT_PROCEDURES });
    });

    // Server-side signup conversion (same eventId as the browser pixel → deduplicated).
    if (dto.eventId) {
      void this.meta.send({
        eventName: 'CompleteRegistration', eventId: dto.eventId,
        phone, externalId: tenant.id, fbp: dto.fbp, fbc: dto.fbc, ip, ua,
      });
    }

    // Auto-login the owner so onboarding continues straight to the paywall/pay screen.
    return this.login(phone, dto.password);
  }

  // Current user incl. granted permissions (admin/owner = all).
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    return { ...this.shape(user), tenant: tenant ? this.tenantShape(tenant) : null };
  }

  private tenantShape(t: any) {
    return { id: t.id, slug: t.slug, name: t.name };
  }

  private shape(user: any) {
    let permissions: string[] = [];
    try { permissions = JSON.parse(user.permissions || '[]'); } catch { permissions = []; }
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role, // OWNER | ADMIN | ASSISTANT (OWNER/ADMIN treated as all on the client)
      permissions,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { success: true };
  }
}
