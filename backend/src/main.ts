import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { execSync, execFileSync } from 'child_process';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { dataPaths } from './data';
import { IS_OFFLINE } from './config/mode';

// OFFLINE data safety: snapshot the SQLite database (+ its WAL/SHM sidecars) BEFORE any
// schema change, so a software update can never lose data. The DB lives in the user's data
// dir (outside the app), so updating the app never touches it; this is the extra belt-and-braces.
// Keeps the last 20 snapshots in <data>/db-backups.
function snapshotSqliteBeforeMigrate() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:')) return;
  const dbPath = url.replace(/^file:/, '').split('?')[0];
  if (!existsSync(dbPath)) return; // fresh install → nothing to protect yet
  const bakDir = join(dataPaths().dataDir, 'db-backups');
  mkdirSync(bakDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const suf of ['', '-wal', '-shm']) {
    if (existsSync(dbPath + suf)) copyFileSync(dbPath + suf, join(bakDir, `dento-${stamp}.db${suf}`));
  }
  const snaps = readdirSync(bakDir).filter((f) => /^dento-.*\.db$/.test(f))
    .map((f) => ({ f, t: statSync(join(bakDir, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  snaps.slice(20).forEach((x) => {
    for (const suf of ['', '-wal', '-shm']) { try { unlinkSync(join(bakDir, x.f + suf)); } catch { /* ignore */ } }
  });
  console.log(`DB snapshot saved before schema sync: dento-${stamp}.db`);
}

async function bootstrap() {
  // Persistent uploads/backups dir (OUTSIDE the app install dir). The DB is PostgreSQL
  // (multi-tenant SaaS) — its connection comes from DATABASE_URL, not a local file.
  const { uploadsDir, backupDir } = dataPaths();
  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  process.env.UPLOAD_DIR = uploadsDir;
  console.log(`Uploads: ${uploadsDir}`);

  // Bring the DB schema up to date. ONLINE (Postgres): migrate deploy. OFFLINE (SQLite):
  // db push against the generated SQLite schema (no migration history needed for a local file).
  try {
    if (IS_OFFLINE) {
      snapshotSqliteBeforeMigrate(); // safety net: back up the DB before touching the schema
      // Run Prisma's CLI JS directly with THIS node (the bundled runtime) — the .bin/prisma
      // shebang would look for `node` on PATH, which the packaged .exe/.app doesn't provide.
      const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
      execFileSync(process.execPath, [prismaCli, 'db', 'push', '--schema', 'prisma/schema.sqlite.prisma', '--skip-generate', '--accept-data-loss'], { stdio: 'ignore', env: process.env });
      console.log('SQLite schema synced (db push).');
    } else {
      const prismaBin = join(process.cwd(), 'node_modules', '.bin', 'prisma');
      execSync(`"${prismaBin}" migrate deploy`, { stdio: 'ignore', env: process.env, shell: '/bin/sh' });
      console.log('Migrations applied (migrate deploy).');
    }
  } catch (e) {
    console.warn('schema sync skipped/failed — continuing on existing schema.', (e as Error)?.message || '');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.enableShutdownHooks();

  // Large JSON bodies allowed — clinic backup restore can be several MB.
  app.use(json({ limit: '60mb' }));
  app.use(urlencoded({ extended: true, limit: '60mb' }));

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Serve uploaded x-rays / photos / documents from the persistent uploads dir.
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Single-URL serve: backend also serves the built frontend + SPA fallback (one port).
  const frontendDist = join(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
    const express = app.getHttpAdapter().getInstance();
    express.get(/^(?!\/api|\/uploads).*/, (_req: any, res: any) => {
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`Dental backend running at http://${host}:${port}/api`);
}
bootstrap();
