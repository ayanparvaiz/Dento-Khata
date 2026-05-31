import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { prepareData, dataPaths } from './data';

async function bootstrap() {
  // 1) Persistent data folder (OUTSIDE the app install dir) so updates never lose data.
  //    Auto-restores from the newest backup if the DB is missing; migrates a legacy in-app DB once.
  const { dbFile, uploadsDir, backupDir, action } = prepareData();
  process.env.DATABASE_URL = `file:${dbFile}`;
  process.env.UPLOAD_DIR = uploadsDir;
  console.log(`Data: ${dbFile} (${action})`);

  // 2) Safety net: snapshot BEFORE migrating, so a bad update is always reversible.
  try {
    if (existsSync(dbFile)) copyFileSync(dbFile, join(backupDir, `pre-migrate-${Date.now()}.db`));
  } catch (e) {
    console.warn('pre-migration backup failed', e);
  }

  // 3) Apply pending schema migrations to existing data (safe + idempotent on updates).
  try {
    // Windows uses prisma.cmd, macOS/Linux uses prisma — works on both.
    const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
    const prismaBin = join(process.cwd(), 'node_modules', '.bin', binName);
    execSync(`"${prismaBin}" migrate deploy`, { stdio: 'ignore', env: process.env, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });
    console.log('Migrations applied (migrate deploy).');
  } catch {
    console.warn('migrate deploy skipped/failed — continuing on existing schema.');
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks(); // lets the backup service snapshot on graceful shutdown

  // Permissive CORS — offline private LAN.
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');

  // Serve uploaded x-rays / photos / documents from the persistent uploads dir.
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Single-URL serve: backend also serves the built frontend + SPA fallback (one LAN port).
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
