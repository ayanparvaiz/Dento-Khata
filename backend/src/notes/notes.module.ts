import { Body, Controller, Delete, Get, Injectable, Module, Param, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class CreateNoteDto {
  @IsString() @MinLength(1) content: string;
}

@Injectable()
class NotesService {
  constructor(private prisma: PrismaService) {}
  list(patientId: string) {
    return this.prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }
  create(patientId: string, content: string, authorId?: string) {
    return this.prisma.clinicalNote.create({ data: { patientId, content, authorId } });
  }
  remove(id: string) {
    return this.prisma.clinicalNote.delete({ where: { id } });
  }
}

@Controller()
class NotesController {
  constructor(private svc: NotesService) {}
  @Get('patients/:id/notes')
  list(@Param('id') id: string) {
    return this.svc.list(id);
  }
  @Post('patients/:id/notes')
  create(@Param('id') id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(id, dto.content, user.id);
  }
  @Delete('notes/:noteId')
  remove(@Param('noteId') noteId: string) {
    return this.svc.remove(noteId);
  }
}

@Module({
  providers: [NotesService],
  controllers: [NotesController],
})
export class NotesModule {}
