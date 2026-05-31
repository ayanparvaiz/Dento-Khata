import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

// Lightweight audit: records mutating requests (who, what, when) after they succeed.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const writes = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!writes.includes(method) || req.path?.includes('/auth/login')) {
      return next.handle();
    }
    return next.handle().pipe(
      tap(() => {
        const action = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
        this.prisma.auditLog
          .create({
            data: {
              userId: req.user?.id ?? null,
              action,
              entity: req.path ?? req.url,
              detail: null,
            },
          })
          .catch(() => {
            /* never let audit failure break the request */
          });
      }),
    );
  }
}
