import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { currentStore } from '../tenant/tenant-context';
import { PAID_ONLY_KEY } from './paid-only.decorator';
import { isPaidSub } from './plans';

// Global guard that enforces @PaidOnly: FREE-tier clinics can't hit Pro-only routes.
// No-op on routes without @PaidOnly. Super-admin is exempt.
@Injectable()
export class PaidOnlyGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const paidOnly = this.reflector.getAllAndOverride<boolean>(PAID_ONLY_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!paidOnly) return true;

    const store = currentStore();
    if (store?.isSuperAdmin) return true;

    const sub = await this.prisma.subscription.findFirst();
    if (isPaidSub(sub)) return true;

    throw new ForbiddenException({
      code: 'PAID_ONLY',
      message: 'এই ফিচারটি শুধু প্রো সাবস্ক্রিপশনে পাওয়া যায় — আপগ্রেড করুন।',
    });
  }
}
