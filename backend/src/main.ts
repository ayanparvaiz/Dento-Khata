import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Allow the React frontend on any LAN device (2nd PC, phone) to call the API.
  // The whole system is offline on a private network, so a permissive CORS is fine.
  app.enableCors({ origin: true, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.setGlobalPrefix('api');

  // Serve uploaded x-rays / photos / documents statically.
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'), {
    prefix: '/uploads/',
  });

  // Production single-URL serve: if the built frontend exists, serve it + SPA fallback,
  // so the whole app (UI + API) runs on ONE port for the clinic LAN.
  const frontendDist = join(process.cwd(), '..', 'frontend', 'dist');
  if (existsSync(frontendDist)) {
    app.useStaticAssets(frontendDist);
    const express = app.getHttpAdapter().getInstance();
    // Any GET that isn't /api or /uploads or a static asset -> return index.html (client routing).
    express.get(/^(?!\/api|\/uploads).*/, (_req: any, res: any) => {
      res.sendFile(join(frontendDist, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  // host 0.0.0.0 => reachable from other devices on the router (LAN), not just localhost.
  await app.listen(port, host);
  console.log(`Dental backend running at http://${host}:${port}/api`);
}
bootstrap();
