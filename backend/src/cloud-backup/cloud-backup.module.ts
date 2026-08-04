import {
  Body, Controller, ForbiddenException, Injectable, Module, Post,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';

// ONLINE-only: cloud store for the paid offline-backup add-on. The offline .exe uploads its
// JSON backup here (keyed by license), lists them, and downloads one to restore. Access is
// gated by the license having an active backup entitlement (License.backupUntil in the future).
const KEEP = 15; // keep the last N backups per license

class CbDto {
  @IsString() key: string;
  @IsString() machineId: string;
  @IsOptional() id?: string;
  @IsOptional() data?: any; // the clinic JSON backup (upload only)
}

@Injectable()
export class CloudBackupService {
  constructor(private prisma: PrismaService) {}

  private dir(key: string) {
    const safe = key.replace(/[^A-Z0-9-]/gi, '');
    const d = join(dataPaths().dataDir, 'cloud-backups', safe);
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
    return d;
  }

  // License must exist, match this machine, and have a live backup plan.
  private async assertPlan(key: string, machineId: string) {
    const lic = await this.prisma.license.findUnique({ where: { key: (key || '').trim().toUpperCase() } });
    if (!lic || lic.status === 'REVOKED') throw new ForbiddenException({ code: 'LICENSE_INVALID', message: 'লাইসেন্স সঠিক নয়।' });
    if (lic.machineId && lic.machineId !== machineId) throw new ForbiddenException({ code: 'MACHINE_MISMATCH', message: 'লাইসেন্স অন্য কম্পিউটারের।' });
    if (!lic.backupUntil || lic.backupUntil.getTime() < Date.now())
      throw new ForbiddenException({ code: 'NO_BACKUP_PLAN', message: 'ক্লাউড ব্যাকআপ চালু নেই। চালু করতে যোগাযোগ করুন।' });
    return lic;
  }

  async upload(dto: CbDto) {
    await this.assertPlan(dto.key, dto.machineId);
    if (!dto.data) throw new ForbiddenException({ code: 'NO_DATA', message: 'ব্যাকআপ ডেটা নেই।' });
    const dir = this.dir(dto.key);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    writeFileSync(join(dir, `backup-${stamp}.json`), JSON.stringify(dto.data));
    // prune old
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
    files.slice(KEEP).forEach((x) => { try { unlinkSync(join(dir, x.f)); } catch { /* ignore */ } });
    return { ok: true, count: Math.min(files.length, KEEP) }; // files already includes the new one
  }

  async list(dto: CbDto) {
    await this.assertPlan(dto.key, dto.machineId);
    const dir = this.dir(dto.key);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
      .map((f) => { const st = statSync(join(dir, f)); return { id: f, date: st.mtime, sizeKB: Math.round(st.size / 1024) }; })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date));
    return { backups: files };
  }

  async download(dto: CbDto) {
    await this.assertPlan(dto.key, dto.machineId);
    if (!dto.id || dto.id.includes('/') || dto.id.includes('..')) throw new ForbiddenException({ code: 'BAD_ID', message: 'ভুল আইডি।' });
    const file = join(this.dir(dto.key), dto.id);
    if (!existsSync(file)) throw new ForbiddenException({ code: 'NOT_FOUND', message: 'ব্যাকআপ পাওয়া যায়নি।' });
    return { data: JSON.parse(readFileSync(file, 'utf8')) };
  }
}

@Controller('cloud-backup')
class CloudBackupController {
  constructor(private svc: CloudBackupService) {}
  @Public() @NoSubscription() @Post('upload')
  upload(@Body() dto: CbDto) { return this.svc.upload(dto); }
  @Public() @NoSubscription() @Post('list')
  list(@Body() dto: CbDto) { return this.svc.list(dto); }
  @Public() @NoSubscription() @Post('download')
  download(@Body() dto: CbDto) { return this.svc.download(dto); }
}

@Module({ providers: [CloudBackupService], controllers: [CloudBackupController] })
export class CloudBackupModule {}
