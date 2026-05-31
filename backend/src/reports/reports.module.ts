import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Requires } from '../auth/permissions.guard';

@Injectable()
class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Installments collected on a given day, grouped by method.
  async dailyCollection(dateStr?: string) {
    const day = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const payments = await this.prisma.payment.findMany({
      where: { paidAt: { gte: start, lt: end } },
      include: { patient: true },
    });
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      total += p.amount;
    }
    return {
      date: start.toISOString().slice(0, 10),
      total,
      byMethod,
      count: payments.length,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        patient: p.patient?.fullName,
        paidAt: p.paidAt,
      })),
    };
  }

  // Patients who still owe: treatment plan total − installments paid > 0.
  async outstanding() {
    const patients = await this.prisma.patient.findMany({
      where: { isActive: true },
      include: { treatmentPlans: { include: { items: true } }, payments: true },
    });
    const rows = patients
      .map((p) => {
        const total = p.treatmentPlans.flatMap((tp) => tp.items).reduce((s, i) => s + i.fee, 0);
        const paid = p.payments.reduce((s, pay) => s + pay.amount, 0);
        return { patientId: p.id, patient: p.fullName, patientCode: p.code, total, paid, balance: total - paid };
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    return { rows, totalOutstanding: rows.reduce((s, r) => s + r.balance, 0) };
  }
}

@Controller('reports')
class ReportsController {
  constructor(private svc: ReportsService) {}
  @Requires('reports.view')
  @Get('daily-collection')
  daily(@Query('date') date?: string) {
    return this.svc.dailyCollection(date);
  }
  @Requires('reports.view')
  @Get('outstanding')
  outstanding() {
    return this.svc.outstanding();
  }
}

@Module({ providers: [ReportsService], controllers: [ReportsController] })
export class ReportsModule {}
