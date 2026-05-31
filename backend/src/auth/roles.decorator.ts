import { SetMetadata } from '@nestjs/common';
import { Role } from './roles';

export const ROLES_KEY = 'roles';

// Usage: @Roles('ADMIN') or @Roles('ADMIN', 'DENTIST') on a controller/handler.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
