import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const REQUIRES_KEY = 'requiresCap';
// Mark a route as needing a capability: @Requires('treatment.manage')
// Pass several to allow ANY of them: @Requires('billing.manage', 'appointments.manage')
export const Requires = (...caps: string[]) => SetMetadata(REQUIRES_KEY, caps);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const caps = this.reflector.getAllAndOverride<string[]>(REQUIRES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!caps || caps.length === 0) return true; // no capability required
    const reqUser = context.switchToHttp().getRequest().user;
    if (!reqUser) throw new ForbiddenException();
    if (reqUser.role === 'ADMIN' || reqUser.role === 'OWNER') return true; // owner/admin can do everything

    // ASSISTANT: must have AT LEAST ONE of the capabilities (fetched fresh so changes apply immediately).
    const user = await this.prisma.user.findUnique({ where: { id: reqUser.id }, select: { permissions: true } });
    let perms: string[] = [];
    try { perms = JSON.parse(user?.permissions || '[]'); } catch { perms = []; }
    if (!caps.some((c) => perms.includes(c))) {
      throw new ForbiddenException(`You don't have permission: ${caps.join(' or ')}`);
    }
    return true;
  }
}
