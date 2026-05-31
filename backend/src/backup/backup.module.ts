import { Controller, Get, Injectable, Module, OnApplicationShutdown, OnModuleInit, Post, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { dataPaths } from '../data';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

const KEEP = 30; // keep last 30 daily backups

@Injectable()
export class BackupService implements OnModuleInit, OnApplicationShutdown {
  constructor(private prisma: PrismaService) {}

  // Backup on startup, every 6 hours, and on graceful shutdown — data loss is not acceptable.
  async onModuleInit() {
    try { await this.backupNow(); } catch (e) { console.warn('startup backup failed', e); }
  }

  async onApplicationShutdown() {
    try { await this.backupNow(); } catch { /* shutting down */ }
  }

  @Cron('0 */6 * * *')
  async periodic() {
    try { await this.backupNow(); } catch (e) { console.warn('scheduled backup failed', e); }
  }

  // Atomic SQLite snapshot (includes WAL) into a SEPARATE backups folder.
  async backupNow() {
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const target = join(backupDir, `dental-${date}.db`);
    if (existsSync(target)) unlinkSync(target); // overwrite same-day
    const safe = target.replace(/'/g, "''");
    await this.prisma.$executeRawUnsafe(`VACUUM INTO '${safe}'`);
    this.prune(backupDir);
    return { file: target, date };
  }

  private prune(backupDir: string) {
    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(KEEP).forEach((x) => { try { unlinkSync(join(backupDir, x.f)); } catch { /* ignore */ } });
  }

  list() {
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) return { dir: backupDir, backups: [] };
    const backups = readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const st = statSync(join(backupDir, f));
        return { name: f, sizeKB: Math.round(st.size / 1024), modified: st.mtime };
      })
      .sort((a, b) => +new Date(b.modified) - +new Date(a.modified));
    return { dir: backupDir, backups };
  }
}

@Controller('backup')
class BackupController {
  constructor(private svc: BackupService) {}

  @UseGuards(RolesGuard) @Roles('ADMIN')
  @Get('list')
  list() {
    return this.svc.list();
  }

  @UseGuards(RolesGuard) @Roles('ADMIN')
  @Post('now')
  now() {
    return this.svc.backupNow();
  }
}

@Module({ providers: [BackupService], controllers: [BackupController] })
export class BackupModule {}
