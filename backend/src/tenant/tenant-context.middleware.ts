import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';
import { tenantStorage, TenantStore } from './tenant-context';

// Runs for EVERY request (before guards). Decodes the Bearer JWT (if any) and opens an
// AsyncLocalStorage context carrying tenantId, so the Prisma middleware can auto-scope queries.
// Unauthenticated routes (login/signup) run with tenantId=null; those paths pass tenantId explicitly.
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private jwt: JwtService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const store: TenantStore = { tenantId: null, userId: null, role: null, isSuperAdmin: false };

    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const payload: any = this.jwt.verify(auth.slice(7));
        if (payload?.superAdmin === true || payload?.role === 'SUPERADMIN') {
          store.isSuperAdmin = true;
          store.userId = payload.sub ?? null;
          store.role = 'SUPERADMIN';
        } else {
          store.tenantId = payload?.tenantId ?? null;
          store.userId = payload?.sub ?? null;
          store.role = payload?.role ?? null;
        }
      } catch {
        // invalid/expired token → leave context empty; the JWT guard will reject the request.
      }
    }

    tenantStorage.run(store, () => next());
  }
}
