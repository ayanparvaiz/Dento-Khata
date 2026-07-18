import { Body, Controller, Get, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { dataPaths } from '../data';
import { currentTenantId } from '../tenant/tenant-context';

// Per-tenant logo dir, resolved at request time (uploads dir only ready after bootstrap).
const logoDir = () => join(dataPaths().uploadsDir, currentTenantId() || '_shared', 'clinic');

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // Any authenticated user can read clinic settings (needed for letterhead, notation, etc.).
  @Get()
  get() {
    return this.settings.get();
  }

  // Only ADMIN/OWNER can change clinic settings.
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  // Upload the clinic/doctor logo for the letterhead (admin/owner only).
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = logoDir();
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `logo-${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    const logoPath = `/uploads/${currentTenantId() || '_shared'}/clinic/${file.filename}`;
    return this.settings.update({ logoPath });
  }
}
