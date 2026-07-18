import {
  Body, Controller, Get, Injectable, Module, Param, Post,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { Requires } from '../auth/permissions.guard';

// Patient pays the treatment-plan total in installments across visits.
class InstallmentDto {
  @IsNumber() amount: number;
  @IsString() method: string; // CASH | BKASH | NAGAD | CARD | OTHER
  @IsOptional() @IsString() appointmentId?: string; // visit it was collected at
  @IsOptional() @IsString() treatmentRecordId?: string; // treatment-record visit (per-visit invoice)
  @IsOptional() @IsString() note?: string;
}

@Injectable()
class BillingService {
  constructor(private prisma: PrismaService) {}

  // Account = treatment plan total (the charge / due) vs installments paid.
  async ledger(patientId: string) {
    const items = await this.prisma.treatmentItem.findMany({ where: { plan: { patientId } } });
    const total = items.reduce((s, i) => s + i.fee, 0);
    const completed = items.filter((i) => i.status === 'COMPLETED').reduce((s, i) => s + i.fee, 0);
    const pays = await this.payments(patientId);
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    return { total, completed, paid, balance: total - paid };
  }

  payments(patientId: string) {
    return this.prisma.payment.findMany({
      where: { OR: [{ patientId }, { invoice: { patientId } }] },
      orderBy: { paidAt: 'desc' },
    });
  }

  addInstallment(patientId: string, dto: InstallmentDto, userId?: string) {
    return this.prisma.payment.create({
      data: {
        patientId,
        appointmentId: dto.appointmentId,
        treatmentRecordId: dto.treatmentRecordId,
        amount: dto.amount,
        method: dto.method,
        note: dto.note,
        receivedBy: userId,
      },
    });
  }
}

@Controller()
class BillingController {
  constructor(private svc: BillingService) {}

  @Get('patients/:id/ledger')
  ledger(@Param('id') id: string) {
    return this.svc.ledger(id);
  }
  @Get('patients/:id/payments')
  payments(@Param('id') id: string) {
    return this.svc.payments(id);
  }
  // Collecting a payment is allowed for a billing user, the doctor (treatment), OR an
  // appointments-only receptionist (who collects from the appointment screen for the day).
  @Requires('billing.manage', 'appointments.manage', 'treatment.manage')
  @Post('patients/:id/payments')
  pay(@Param('id') id: string, @Body() dto: InstallmentDto, @CurrentUser() user: AuthUser) {
    return this.svc.addInstallment(id, dto, user.id);
  }
}

@Module({ providers: [BillingService], controllers: [BillingController] })
export class BillingModule {}
