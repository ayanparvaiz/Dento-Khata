import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Requires } from '../auth/permissions.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

class CreatePlanDto {
  @IsOptional() @IsString() title?: string;
}
class AddItemDto {
  @IsString() procedureId: string;
  @IsOptional() @IsString() toothNumber?: string;
  @IsOptional() @IsNumber() priority?: number;
  @IsOptional() @IsNumber() fee?: number;
  @IsOptional() @IsIn(['PLANNED', 'COMPLETED']) status?: string;
}
class UpdateItemDto {
  @IsOptional() @IsIn(['PLANNED', 'COMPLETED']) status?: string;
  @IsOptional() @IsNumber() fee?: number;
  @IsOptional() @IsNumber() priority?: number;
  @IsOptional() @IsString() toothNumber?: string;
}
class CreateRecordDto {
  @IsString() content: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsNumber() amount?: number; // charge for this visit
  @IsOptional() @IsString() visitDate?: string; // ISO; defaults to now
}
class UpdateRecordDto {
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsString() visitDate?: string;
}

@Injectable()
class TreatmentService {
  constructor(private prisma: PrismaService) {}

  getPlans(patientId: string) {
    return this.prisma.treatmentPlan.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { procedure: true }, orderBy: { priority: 'asc' } } },
    });
  }

  createPlan(patientId: string, dto: CreatePlanDto) {
    return this.prisma.treatmentPlan.create({
      data: { patientId, title: dto.title ?? 'Treatment plan' },
      include: { items: { include: { procedure: true } } },
    });
  }

  deletePlan(planId: string) {
    return this.prisma.treatmentPlan.delete({ where: { id: planId } });
  }

  async addItem(planId: string, dto: AddItemDto) {
    const proc = await this.prisma.procedure.findUnique({ where: { id: dto.procedureId } });
    if (!proc) throw new NotFoundException('Procedure not found');
    return this.prisma.treatmentItem.create({
      data: {
        planId,
        procedureId: dto.procedureId,
        toothNumber: dto.toothNumber,
        priority: dto.priority ?? 0,
        fee: dto.fee ?? proc.defaultFee,
        status: dto.status ?? 'PLANNED',
      },
      include: { procedure: true },
    });
  }

  updateItem(itemId: string, dto: UpdateItemDto) {
    return this.prisma.treatmentItem.update({
      where: { id: itemId },
      data: {
        ...dto,
        ...(dto.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        ...(dto.status === 'PLANNED' ? { completedAt: null } : {}),
      },
      include: { procedure: true },
    });
  }

  deleteItem(itemId: string) {
    return this.prisma.treatmentItem.delete({ where: { id: itemId } });
  }

  // --- Treatment records (per-visit dated log) ---
  getRecords(patientId: string) {
    return this.prisma.treatmentRecord.findMany({
      where: { patientId },
      orderBy: { visitDate: 'desc' },
      include: { plan: { select: { id: true, title: true } } },
    });
  }
  addRecord(patientId: string, dto: CreateRecordDto, authorId?: string) {
    return this.prisma.treatmentRecord.create({
      data: {
        patientId,
        content: dto.content,
        planId: dto.planId || null,
        amount: dto.amount ?? 0,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : new Date(),
        authorId,
      },
    });
  }
  updateRecord(id: string, dto: UpdateRecordDto) {
    return this.prisma.treatmentRecord.update({
      where: { id },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.planId !== undefined ? { planId: dto.planId || null } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.visitDate ? { visitDate: new Date(dto.visitDate) } : {}),
      },
    });
  }
  deleteRecord(id: string) {
    return this.prisma.treatmentRecord.delete({ where: { id } });
  }
}

@Controller()
class TreatmentController {
  constructor(private svc: TreatmentService) {}

  @Get('patients/:id/treatment')
  getPlans(@Param('id') id: string) {
    return this.svc.getPlans(id);
  }
  @Requires('treatment.manage')
  @Post('patients/:id/treatment')
  createPlan(@Param('id') id: string, @Body() dto: CreatePlanDto) {
    return this.svc.createPlan(id, dto);
  }
  @Requires('treatment.manage')
  @Delete('treatment/:planId')
  deletePlan(@Param('planId') planId: string) {
    return this.svc.deletePlan(planId);
  }
  @Requires('treatment.manage')
  @Post('treatment/:planId/items')
  addItem(@Param('planId') planId: string, @Body() dto: AddItemDto) {
    return this.svc.addItem(planId, dto);
  }
  @Requires('treatment.manage')
  @Patch('treatment/items/:itemId')
  updateItem(@Param('itemId') itemId: string, @Body() dto: UpdateItemDto) {
    return this.svc.updateItem(itemId, dto);
  }
  @Requires('treatment.manage')
  @Delete('treatment/items/:itemId')
  deleteItem(@Param('itemId') itemId: string) {
    return this.svc.deleteItem(itemId);
  }

  // Treatment records (visit log)
  @Get('patients/:id/treatment-records')
  getRecords(@Param('id') id: string) {
    return this.svc.getRecords(id);
  }
  @Requires('treatment.manage')
  @Post('patients/:id/treatment-records')
  addRecord(@Param('id') id: string, @Body() dto: CreateRecordDto, @CurrentUser() user: AuthUser) {
    return this.svc.addRecord(id, dto, user?.id);
  }
  @Requires('treatment.manage')
  @Patch('treatment-records/:recordId')
  updateRecord(@Param('recordId') recordId: string, @Body() dto: UpdateRecordDto) {
    return this.svc.updateRecord(recordId, dto);
  }
  @Requires('treatment.manage')
  @Delete('treatment-records/:recordId')
  deleteRecord(@Param('recordId') recordId: string) {
    return this.svc.deleteRecord(recordId);
  }
}

@Module({
  providers: [TreatmentService],
  controllers: [TreatmentController],
})
export class TreatmentModule {}
