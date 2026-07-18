import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { currentStore } from '../tenant/tenant-context';

// Allows only requests carrying a super-admin JWT (set on the ALS context by the tenant middleware).
// Super-admin routes are marked @Public so the tenant JWT guard is skipped; this guard replaces it.
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!currentStore()?.isSuperAdmin) throw new ForbiddenException('Super-admin only');
    return true;
  }
}
