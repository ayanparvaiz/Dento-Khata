import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Requires } from '../auth/permissions.guard';
import { PaidOnly } from '../subscription/paid-only.decorator';

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

  // Revenue / income collected over the last N days (today, 7, 30, 90, 180, 365).
  async revenue(days: number) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (Math.max(1, days) - 1)); // inclusive of today
    const payments = await this.prisma.payment.findMany({
      where: { paidAt: { gte: start } },
      orderBy: { paidAt: 'asc' },
    });
    const byMethod: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let total = 0;
    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + p.amount;
      total += p.amount;
    }
    const series = Object.entries(byDay).map(([date, amount]) => ({ date, amount }));
    return { days, from: start.toISOString().slice(0, 10), total, count: payments.length, byMethod, series };
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

@PaidOnly() // full analytics is a Pro feature (FREE clinics still see dues on the patient/dashboard)
@Controller('reports')
class ReportsController {
  constructor(private svc: ReportsService) {}
  @Requires('reports.view')
  @Get('daily-collection')
  daily(@Query('date') date?: string) {
    return this.svc.dailyCollection(date);
  }
  @Requires('reports.view')
  @Get('revenue')
  revenue(@Query('days') days?: string) {
    return this.svc.revenue(Number(days) || 30);
  }
  @Requires('reports.view')
  @Get('outstanding')
  outstanding() {
    return this.svc.outstanding();
  }
}

@Module({ providers: [ReportsService], controllers: [ReportsController] })
export class ReportsModule {}
