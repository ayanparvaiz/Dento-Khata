import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { runInTenant } from '../tenant/tenant-context';
import { DEFAULT_PROCEDURES } from '../auth/default-procedures';
import { PAID_PLAN } from '../subscription/plans';
import { IS_OFFLINE } from '../config/mode';

// OFFLINE first-run bootstrap. The .exe has no public signup, so on the very first launch
// (empty database) we create the single clinic + its owner account, settings and starter
// procedures — exactly what signup() would build online, minus the SaaS plumbing.
// Credentials come from env (set by the installer/license step) with safe defaults the
// doctor changes later in Settings. No-op online, and no-op once a clinic already exists.
@Injectable()
export class OfflineBootstrapService implements OnModuleInit {
  private readonly log = new Logger('OfflineBootstrap');
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (!IS_OFFLINE) return;
    try {
      const existing = await this.prisma.tenant.findFirst();
      if (existing) return; // already set up

      const clinicName = process.env.OFFLINE_CLINIC_NAME || 'আমার ডেন্টাল চেম্বার';
      const ownerName = process.env.OFFLINE_OWNER_NAME || 'ডাক্তার';
      const phone = (process.env.OFFLINE_OWNER_PHONE || '01700000000').trim();
      const password = process.env.OFFLINE_OWNER_PASSWORD || 'admin1234';

      const tenant = await this.prisma.tenant.create({
        data: { slug: 'clinic', name: clinicName, ownerName, phone },
      });

      await runInTenant(tenant.id, async () => {
        await this.prisma.user.create({
          data: { phone, username: ownerName, passwordHash: await bcrypt.hash(password, 10), fullName: ownerName, role: 'OWNER', isActive: true },
        });
        // A subscription row is kept for shape only; offline is always unlocked (see isPaidSub).
        await this.prisma.subscription.create({
          data: { plan: PAID_PLAN, status: 'ACTIVE', amount: 0, currentPeriodEnd: null },
        });
        await this.prisma.clinicSettings.create({ data: { name: clinicName, phone } });
        await this.prisma.procedure.createMany({ data: DEFAULT_PROCEDURES });
      });

      this.log.log(`Offline clinic created: "${clinicName}" — owner login ${phone}`);
    } catch (e) {
      this.log.error(`Offline bootstrap failed: ${(e as Error).message}`);
    }
  }
}

@Module({ providers: [OfflineBootstrapService] })
export class OfflineModule {}
