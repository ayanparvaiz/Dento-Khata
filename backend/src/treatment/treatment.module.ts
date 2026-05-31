import {
  Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Requires } from '../auth/permissions.guard';

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
}

@Module({
  providers: [TreatmentService],
  controllers: [TreatmentController],
})
export class TreatmentModule {}
