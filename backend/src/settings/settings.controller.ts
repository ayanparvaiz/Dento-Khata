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

const LOGO_DIR = join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), 'clinic');

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // Any authenticated user can read clinic settings (needed for letterhead, notation, etc.).
  @Get()
  get() {
    return this.settings.get();
  }

  // Only ADMIN can change clinic settings.
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  // Upload the clinic/doctor logo for the letterhead (admin only).
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(LOGO_DIR)) mkdirSync(LOGO_DIR, { recursive: true });
          cb(null, LOGO_DIR);
        },
        filename: (_req, file, cb) => cb(null, `logo-${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    }),
  )
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    const logoPath = `/uploads/clinic/${file.filename}`;
    return this.settings.update({ logoPath });
  }
}
