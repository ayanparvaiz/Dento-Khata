import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VisitDto } from './dto';

@Injectable()
export class AnalyticsService {
  private readonly log = new Logger('Analytics');
  constructor(private prisma: PrismaService) {}

  // Upsert a visit by its client-generated `sid`. Values only ever move forward
  // (max duration/scroll) because reports arrive repeatedly during one visit and can
  // race/arrive out of order (heartbeat vs the final page-hide beacon).
  async recordVisit(dto: VisitDto, ip: string, ua: string) {
    try {
      const device = dto.device || (/(Mobi|Android|iPhone|iPad)/i.test(ua) ? 'mobile' : 'desktop');
      const dur = Math.max(0, Math.min(dto.durationMs ?? 0, 86_400_000));
      const scroll = Math.max(0, Math.min(dto.maxScroll ?? 0, 100));

      const existing = await this.prisma.visitSession.findUnique({ where: { sid: dto.sid } });
      if (!existing) {
        await this.prisma.visitSession.create({
          data: {
            sid: dto.sid,
            path: dto.path || '/',
            referrer: dto.referrer || null,
            utmSource: dto.utmSource || null,
            utmCampaign: dto.utmCampaign || null,
            ip: ip || null,
            ua: ua || null,
            device,
            durationMs: dur,
            maxScroll: scroll,
            signedUp: !!dto.signedUp,
          },
        });
        return;
      }
      await this.prisma.visitSession.update({
        where: { sid: dto.sid },
        data: {
          durationMs: Math.max(existing.durationMs, dur),
          maxScroll: Math.max(existing.maxScroll, scroll),
          signedUp: existing.signedUp || !!dto.signedUp,
        },
      });
    } catch (e) {
      this.log.warn(`recordVisit failed: ${(e as Error).message}`);
    }
  }
}
