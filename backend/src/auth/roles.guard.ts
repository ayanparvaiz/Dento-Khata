import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Role } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @Roles => any authenticated user

    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('You do not have permission for this action');
    if (user.role === 'OWNER') return true; // clinic owner can do everything within the tenant
    if (!required.includes(user.role)) {
      throw new ForbiddenException('You do not have permission for this action');
    }
    return true;
  }
}
