import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// All patient data lives OUTSIDE the app install folder so updates/reinstalls never touch it.
// Override with env DATA_DIR (production sets this to e.g. %APPDATA%\DentalManager).
export function dataPaths() {
  const dataDir =
    process.env.DATA_DIR ||
    (process.env.NODE_ENV === 'production'
      ? join(homedir(), 'DentalManagerData')
      : join(process.cwd(), '..', 'data'));
  const dbFile = join(dataDir, 'dental.db');
  const uploadsDir = join(dataDir, 'uploads');
  const backupDir = process.env.BACKUP_DIR || join(dataDir, 'backups');
  return { dataDir, dbFile, uploadsDir, backupDir };
}

export function newestBackup(backupDir: string): string | null {
  if (!existsSync(backupDir)) return null;
  const files = readdirSync(backupDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ f: join(backupDir, f), t: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return files[0]?.f ?? null;
}

// Prepare the persistent data location BEFORE the app/Prisma starts.
// Returns what happened so we can log it.
export function prepareData(): { dbFile: string; uploadsDir: string; backupDir: string; action: string } {
  const { dataDir, dbFile, uploadsDir, backupDir } = dataPaths();
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  let action = 'existing';
  if (!existsSync(dbFile)) {
    // 1) DB missing → auto-restore the newest backup (data recovery, nothing lost).
    const backup = newestBackup(backupDir);
    if (backup) {
      copyFileSync(backup, dbFile);
      action = `restored from ${backup}`;
    } else {
      // 2) First run after moving to data dir → carry over the legacy in-app DB if present.
      const legacy = join(process.cwd(), 'prisma', 'dental.db');
      if (existsSync(legacy)) {
        copyFileSync(legacy, dbFile);
        const legacyUploads = join(process.cwd(), 'uploads', 'patients');
        if (existsSync(legacyUploads)) {
          try { cpDir(legacyUploads, join(uploadsDir, 'patients')); } catch { /* best effort */ }
        }
        action = 'migrated legacy app DB';
      } else {
        action = 'fresh (will migrate + seed)';
      }
    }
  }
  return { dbFile, uploadsDir, backupDir, action };
}

function cpDir(src: string, dst: string) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) cpDir(s, d);
    else copyFileSync(s, d);
  }
}
