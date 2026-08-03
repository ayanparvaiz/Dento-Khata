import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Post,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Requires } from '../auth/permissions.guard';
import { PaidOnly } from '../subscription/paid-only.decorator';
import { currentTenantId } from '../tenant/tenant-context';

// UPLOAD_DIR is set to an absolute persistent path at startup (see main.ts).
const uploadRoot = () => process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

@Injectable()
class ImagingService {
  constructor(private prisma: PrismaService) {}

  list(patientId: string) {
    return this.prisma.patientFile.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  create(patientId: string, file: Express.Multer.File, body: any, userId?: string) {
    const isImage = file.mimetype.startsWith('image/');
    const tid = currentTenantId() || '_shared';
    return this.prisma.patientFile.create({
      data: {
        patientId,
        filePath: `/uploads/${tid}/patients/${patientId}/${file.filename}`,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileType: isImage ? 'IMAGE' : 'DOCUMENT',
        category: body.category || 'OTHER',
        toothNumber: body.toothNumber || null,
        caption: body.caption || null,
        takenAt: body.takenAt ? new Date(body.takenAt) : null,
        uploadedBy: userId,
      },
    });
  }

  async remove(fileId: string) {
    const f = await this.prisma.patientFile.findUnique({ where: { id: fileId } });
    if (!f) throw new NotFoundException('File not found');
    try {
      // filePath is a URL like /uploads/patients/<id>/<file>; map it back to the persistent disk dir.
      const rel = f.filePath.replace(/^\/uploads\//, '');
      unlinkSync(join(uploadRoot(), rel));
    } catch {
      /* file already gone */
    }
    return this.prisma.patientFile.delete({ where: { id: fileId } });
  }
}

@Controller()
class ImagingController {
  constructor(private svc: ImagingService) {}

  @Get('patients/:id/files')
  list(@Param('id') id: string) {
    return this.svc.list(id);
  }

  @PaidOnly() // x-ray / image storage is a Pro feature
  @Requires('imaging.manage')
  @Post('patients/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const tid = currentTenantId() || '_shared';
          const dir = join(uploadRoot(), tid, 'patients', String(req.params.id));
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  upload(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.create(id, file, body, user.id);
  }

  @Requires('imaging.manage')
  @Delete('files/:fileId')
  remove(@Param('fileId') fileId: string) {
    return this.svc.remove(fileId);
  }
}

@Module({ providers: [ImagingService], controllers: [ImagingController] })
export class ImagingModule {}
