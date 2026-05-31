import {
  Body, Controller, Delete, Get, Injectable, Module, Param, Post,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Requires } from '../auth/permissions.guard';

class RxItemDto {
  @IsOptional() @IsString() drugId?: string;
  @IsString() drugName: string;
  @IsOptional() @IsString() generic?: string;
  @IsString() dosage: string; // e.g. "1+0+1"
  @IsOptional() @IsString() frequency?: string;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() route?: string;
  @IsOptional() @IsString() instruction?: string;
}
class CreateRxDto {
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() advice?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RxItemDto) items: RxItemDto[];
}

@Injectable()
class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  list(patientId: string) {
    return this.prisma.prescription.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
  }

  getOne(id: string) {
    return this.prisma.prescription.findUnique({
      where: { id },
      include: { items: true, patient: true },
    });
  }

  create(patientId: string, dto: CreateRxDto, dentistId?: string) {
    return this.prisma.prescription.create({
      data: {
        patientId,
        dentistId,
        diagnosis: dto.diagnosis,
        advice: dto.advice,
        items: { create: dto.items },
      },
      include: { items: true },
    });
  }

  remove(id: string) {
    return this.prisma.prescription.delete({ where: { id } });
  }
}

@Controller()
class PrescriptionsController {
  constructor(private svc: PrescriptionsService) {}
  @Get('patients/:id/prescriptions')
  list(@Param('id') id: string) {
    return this.svc.list(id);
  }
  @Get('prescriptions/:rxId')
  getOne(@Param('rxId') rxId: string) {
    return this.svc.getOne(rxId);
  }
  @Requires('prescriptions.manage')
  @Post('patients/:id/prescriptions')
  create(@Param('id') id: string, @Body() dto: CreateRxDto, @CurrentUser() user: AuthUser) {
    return this.svc.create(id, dto, user.id);
  }
  @Requires('prescriptions.manage')
  @Delete('prescriptions/:rxId')
  remove(@Param('rxId') rxId: string) {
    return this.svc.remove(rxId);
  }
}

@Module({ providers: [PrescriptionsService], controllers: [PrescriptionsController] })
export class PrescriptionsModule {}
