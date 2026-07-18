import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const REQUIRES_KEY = 'requiresCap';
// Mark a route as needing a capability: @Requires('treatment.manage')
export const Requires = (cap: string) => SetMetadata(REQUIRES_KEY, cap);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const cap = this.reflector.getAllAndOverride<string>(REQUIRES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!cap) return true; // no capability required
    const reqUser = context.switchToHttp().getRequest().user;
    if (!reqUser) throw new ForbiddenException();
    if (reqUser.role === 'ADMIN' || reqUser.role === 'OWNER') return true; // owner/admin can do everything

    // ASSISTANT: must have the capability granted (fetched fresh so changes apply immediately).
    const user = await this.prisma.user.findUnique({ where: { id: reqUser.id }, select: { permissions: true } });
    let perms: string[] = [];
    try { perms = JSON.parse(user?.permissions || '[]'); } catch { perms = []; }
    if (!perms.includes(cap)) {
      throw new ForbiddenException(`You don't have permission: ${cap}`);
    }
    return true;
  }
}
