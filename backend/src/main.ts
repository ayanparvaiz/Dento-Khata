import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { dataPaths } from './data';

async function bootstrap() {
  // Persistent uploads/backups dir (OUTSIDE the app install dir). The DB is PostgreSQL
  // (multi-tenant SaaS) — its connection comes from DATABASE_URL, not a local file.
  const { uploadsDir, backupDir } = dataPaths();
  mkdirSync(uploadsDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  process.env.UPLOAD_DIR = uploadsDir;
  console.log(`Uploads: ${uploadsDir}`);

  // Apply pending schema migrations (safe + idempotent on updates).
  try {
    const binName = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
    const prismaBin = join(process.cwd(), 'node_modules', '.bin', binName);
    execSync(`"${prismaBin}" migrate deploy`, { stdio: 'ignore', env: process.env, shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh' });
    console.log('Migrations applied (migrate deploy).');
  } catch {
    console.warn('migrate deploy skipped/failed — continuing on existing schema.');
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
