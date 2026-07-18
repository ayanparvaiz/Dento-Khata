import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { NO_SUB_KEY } from './no-subscription.decorator';
import { currentStore } from '../tenant/tenant-context';

// Blocks tenant routes when the clinic's subscription is not active (expired past grace / suspended / pending).
// Runs after JwtAuthGuard, so the tenant context is set. Super-admin + @Public + @NoSubscription are exempt.
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private subs: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const noSub = this.reflector.getAllAndOverride<boolean>(NO_SUB_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || noSub) return true;

    const store = currentStore();
    if (store?.isSuperAdmin) return true;

    const req = context.switchToHttp().getRequest();
    if (!req.user?.tenantId) return true; // no tenant (shouldn't happen post-JWT) → let other guards decide

    const sub = await this.prisma.subscription.findFirst();
    const state = this.subs.computeAccess(sub);
    if (state.active) return true;

    // 402 Payment Required — the frontend intercepts this to show the paywall/renew screen.
    throw new HttpException(
      { code: 'SUBSCRIPTION_INACTIVE', status: state.status, message: 'Subscription inactive — please renew to continue.' },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
