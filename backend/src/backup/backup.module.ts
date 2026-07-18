import { Controller, Get, Injectable, Module, OnModuleInit, Post, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { dataPaths } from '../data';
import { Public } from '../auth/public.decorator';
import { SuperAdminGuard } from '../superadmin/superadmin.guard';

const execFileAsync = promisify(execFile);
const KEEP = 30; // keep last 30 daily dumps

// Whole-database backups via pg_dump (custom format, restorable with pg_restore).
// NOTE: the shared Postgres DB holds ALL tenants — these dumps are PLATFORM-level and
// are therefore restricted to the super-admin, never a clinic owner.
@Injectable()
export class BackupService implements OnModuleInit {
  async onModuleInit() {
    try { await this.backupNow(); } catch (e) { console.warn('startup backup failed', e); }
  }

  @Cron('0 3 * * *') // daily at 03:00
  async periodic() {
    try { await this.backupNow(); } catch (e) { console.warn('scheduled backup failed', e); }
  }

  async backupNow() {
    const url = process.env.DATABASE_URL;
    if (!url || !url.startsWith('postgres')) throw new Error('DATABASE_URL is not Postgres');
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const target = join(backupDir, `dental-${date}.dump`);
    if (existsSync(target)) unlinkSync(target); // overwrite same-day
    // pg_dump rejects libpq-only query params (e.g. ?schema=public) → strip the query string.
    const dumpUrl = url.split('?')[0];
    await execFileAsync('pg_dump', ['-Fc', '--no-owner', '--no-privileges', '-f', target, dumpUrl]);
    this.prune(backupDir);
    return { file: target, date };
  }

  private prune(backupDir: string) {
    const files = readdirSync(backupDir)
      .filter((f) => f.endsWith('.dump'))
      .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    files.slice(KEEP).forEach((x) => { try { unlinkSync(join(backupDir, x.f)); } catch { /* ignore */ } });
  }

  list() {
    const { backupDir } = dataPaths();
    if (!existsSync(backupDir)) return { dir: backupDir, backups: [] };
    const backups = readdirSync(backupDir)
      .filter((f) => f.endsWith('.dump'))
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

  @Public() @UseGuards(SuperAdminGuard)
  @Get('list')
  list() {
    return this.svc.list();
  }

  @Public() @UseGuards(SuperAdminGuard)
  @Post('now')
  now() {
    return this.svc.backupNow();
  }
}

@Module({ providers: [BackupService], controllers: [BackupController] })
export class BackupModule {}
