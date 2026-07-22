import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { AnalyticsService } from './analytics.service';
import { MetaService } from '../meta/meta.service';
import { VisitDto, TrackEventDto } from './dto';

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
  constructor(private svc: AnalyticsService, private meta: MetaService) {}

  @Public()
  @Post('visit')
  visit(@Body() dto: VisitDto, @Req() req: Request) {
    // Never let a tracking write throw into the client — fire and forget.
    void this.svc.recordVisit(dto, clientIp(req), String(req.headers['user-agent'] || ''));
    return { ok: true };
  }

  // Mirror a browser conversion (e.g. WhatsApp Contact click) to Meta via the Conversions
  // API so it reaches Meta even if the browser pixel is blocked. Same eventId → deduped.
  @Public()
  @Post('event')
  event(@Body() dto: TrackEventDto, @Req() req: Request) {
    void this.meta.send({
      eventName: dto.event,
      eventId: dto.eventId,
      fbp: dto.fbp || null,
      fbc: dto.fbc || null,
      sourceUrl: dto.sourceUrl || undefined,
      ip: clientIp(req),
      ua: String(req.headers['user-agent'] || ''),
    });
    return { ok: true };
  }
}
