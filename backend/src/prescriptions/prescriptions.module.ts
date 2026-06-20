import {
  Body, Controller, Delete, Get, Injectable, Module, Param, Post,
} from '@nestjs/common';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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
  @IsOptional() @IsString() timing?: string; // খাবার আগে / পরে / ভরা পেটে
  @IsOptional() @IsString() instruction?: string;
}
class CreateRxDto {
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() chiefComplaint?: string;
  @IsOptional() @IsString() onExam?: string;
  @IsOptional() @IsString() examGrid?: string;
  @IsOptional() @IsString() investigation?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() advice?: string;
  @IsOptional() @IsString() followUp?: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsNumber() totalBill?: number;
  @IsOptional() @IsNumber() discount?: number;
  @IsOptional() @IsNumber() paidToday?: number;
  @IsOptional() @IsInt() visitsNeeded?: number;
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
    const { items, ...fields } = dto;
    return this.prisma.prescription.create({
      data: {
        patientId,
        dentistId,
        diagnosis: fields.diagnosis,
        chiefComplaint: fields.chiefComplaint,
        onExam: fields.onExam,
        examGrid: fields.examGrid,
        investigation: fields.investigation,
        notes: fields.notes,
        advice: fields.advice,
        followUp: fields.followUp,
        planId: fields.planId || null,
        totalBill: fields.totalBill,
        discount: fields.discount,
        paidToday: fields.paidToday,
        visitsNeeded: fields.visitsNeeded,
        items: { create: items },
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
