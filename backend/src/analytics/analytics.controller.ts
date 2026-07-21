import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { AnalyticsService } from './analytics.service';
import { VisitDto } from './dto';

// Real client IP, honouring nginx's X-Forwarded-For.
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd || '').split(',')[0];
  return (first || req.ip || (req.socket as any)?.remoteAddress || '').trim();
}

// Public ingest for landing-page engagement (time on page + scroll depth).
// The browser POSTs here periodically and once more on page-hide (sendBeacon).
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Public()
  @Post('visit')
  visit(@Body() dto: VisitDto, @Req() req: Request) {
    // Never let a tracking write throw into the client — fire and forget.
    void this.svc.recordVisit(dto, clientIp(req), String(req.headers['user-agent'] || ''));
    return { ok: true };
  }
}
