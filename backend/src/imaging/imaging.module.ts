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

// UPLOAD_DIR is set to an absolute persistent path at startup (see main.ts).
const UPLOAD_ROOT = join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), 'patients');

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
    return this.prisma.patientFile.create({
      data: {
        patientId,
        filePath: `/uploads/patients/${patientId}/${file.filename}`,
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
      unlinkSync(join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), rel));
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

  @Post('patients/:id/files')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, _file, cb) => {
          const dir = join(UPLOAD_ROOT, String(req.params.id));
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

  @Delete('files/:fileId')
  remove(@Param('fileId') fileId: string) {
    return this.svc.remove(fileId);
  }
}

@Module({ providers: [ImagingService], controllers: [ImagingController] })
export class ImagingModule {}
