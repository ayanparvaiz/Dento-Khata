import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { HttpAdapterHost, BaseExceptionFilter } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { currentStore } from '../tenant/tenant-context';

// Global exception filter that records server errors + failed logins to the ErrorLog
// table so the super-admin can see them. It ONLY logs on the side and then delegates to
// the default Nest exception handling (super.catch) — the HTTP response is unchanged, so
// no existing behaviour breaks. Logging is best-effort and never throws.
@Catch()
export class ErrorLogFilter extends BaseExceptionFilter {
  private readonly log = new Logger('ErrorLog');

  constructor(private prisma: PrismaService, adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    try {
      this.record(exception, host);
    } catch {
      /* never let logging interfere with the response */
    }
    super.catch(exception, host);
  }

  private record(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const req: any = host.switchToHttp().getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const path: string = req?.originalUrl || req?.url || '';
    const method: string = req?.method || '';
    const isLogin = /\/auth\/login$/.test(path.split('?')[0]);

    // Only keep operator-relevant events: server errors (5xx), login failures, and
    // access-denied (403). Routine 400 validation noise is skipped.
    let kind: string | null = null;
    if (status >= 500) kind = 'ERROR';
    else if (isLogin && status === 401) kind = 'LOGIN_FAIL';
    else if (status === 403) kind = 'FORBIDDEN';
    if (!kind) return;

    const fwd = req?.headers?.['x-forwarded-for'];
    const ip = (Array.isArray(fwd) ? fwd[0] : (fwd || '').split(',')[0]) || req?.ip || '';
    const store = currentStore();
    let message: string;
    if (exception instanceof HttpException) {
      const r = exception.getResponse() as any;
      message = typeof r === 'string' ? r : r?.message || exception.message;
      if (Array.isArray(message)) message = message.join(', ');
    } else {
      message = (exception as Error)?.message || 'Unknown error';
    }

    void this.prisma.errorLog
      .create({
        data: {
          kind,
          status,
          method,
          path: path.slice(0, 200),
          message: String(message).slice(0, 500),
          phone: isLogin ? String(req?.body?.phone || '').slice(0, 20) || null : null,
          tenantId: store?.tenantId || null,
          userId: store?.userId || null,
          ip: ip ? String(ip).trim().slice(0, 60) : null,
          ua: String(req?.headers?.['user-agent'] || '').slice(0, 300) || null,
        },
      })
      .catch((e) => this.log.warn(`errorLog write failed: ${e?.message}`));
  }
}
