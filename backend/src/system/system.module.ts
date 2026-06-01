import {
  Controller, Get, Injectable, Module, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { dataPaths } from '../data';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

function dbPath(): string {
  return dataPaths().dbFile; // persistent data folder
}

@Injectable()
class SystemService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const weekEnd = new Date(start); weekEnd.setDate(weekEnd.getDate() + 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sparkStart = new Date(start); sparkStart.setDate(sparkStart.getDate() - 13);
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const [patientList, todayAppts, weekAppointments, pendingTreatments, completedTreatments, pays, newPatientsMonth] =
      await Promise.all([
        this.prisma.patient.findMany({
          where: { isActive: true },
          select: { id: true, fullName: true, code: true, treatmentPlans: { select: { items: { select: { fee: true } } } }, payments: { select: { amount: true } } },
        }),
        this.prisma.appointment.findMany({
          where: { startTime: { gte: start, lt: end } },
          orderBy: { startTime: 'asc' },
          select: { id: true, startTime: true, status: true, reason: true, chair: true, patient: { select: { id: true, fullName: true, code: true } } },
        }),
        this.prisma.appointment.count({ where: { startTime: { gte: start, lt: weekEnd } } }),
        this.prisma.treatmentItem.count({ where: { status: 'PLANNED' } }),
        this.prisma.treatmentItem.count({ where: { status: 'COMPLETED' } }),
        this.prisma.payment.findMany({ select: { amount: true, paidAt: true } }),
        this.prisma.patient.count({ where: { isActive: true, createdAt: { gte: monthStart } } }),
      ]);

    // Per-patient balance → outstanding total + top dues.
    const dues = patientList
      .map((p) => {
        const charged = p.treatmentPlans.flatMap((tp) => tp.items).reduce((s, i) => s + i.fee, 0);
        const paid = p.payments.reduce((s, x) => s + x.amount, 0);
        return { patientId: p.id, patient: p.fullName, code: p.code, balance: charged - paid };
      })
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    const outstanding = dues.reduce((s, r) => s + r.balance, 0);

    // Revenue today / this month / total + 14-day spark.
    const sparkMap = new Map<string, number>();
    let revenueToday = 0, revenueMonth = 0, revenueTotal = 0, paymentsToday = 0;
    for (const p of pays) {
      revenueTotal += p.amount;
      const t = new Date(p.paidAt);
      if (t >= start && t < end) { revenueToday += p.amount; paymentsToday++; }
      if (t >= monthStart) revenueMonth += p.amount;
      if (t >= sparkStart) sparkMap.set(key(t), (sparkMap.get(key(t)) || 0) + p.amount);
    }
    const spark: { date: string; amount: number }[] = [];
    for (let d = new Date(sparkStart); d <= start; d.setDate(d.getDate() + 1))
      spark.push({ date: key(new Date(d)), amount: sparkMap.get(key(new Date(d))) || 0 });

    const todaySchedule = todayAppts.map((a) => ({
      id: a.id, time: a.startTime, status: a.status, reason: a.reason, chair: a.chair,
      patientId: a.patient?.id, patient: a.patient?.fullName, code: a.patient?.code,
    }));

    return {
      patients: patientList.length,
      newPatientsMonth,
      todayAppointments: todayAppts.length,
      weekAppointments,
      pendingTreatments,
      completedTreatments,
      outstanding,
      revenueToday,
      revenueMonth,
      revenueTotal,
      paymentsToday,
      spark,
      todaySchedule,
      topDues: dues.slice(0, 6),
    };
  }

  backupInfo() {
    const p = dbPath();
    if (!existsSync(p)) return { exists: false };
    const st = statSync(p);
    return { exists: true, sizeKB: Math.round(st.size / 1024), modified: st.mtime };
  }
}

@Controller()
class SystemController {
  constructor(private svc: SystemService) {}

  @Get('stats/dashboard')
  dashboard() {
    return this.svc.dashboard();
  }

  @UseGuards(RolesGuard) @Roles('ADMIN')
  @Get('backup/info')
  info() {
    return this.svc.backupInfo();
  }

  // Download the SQLite database file as a backup (admin only).
  @UseGuards(RolesGuard) @Roles('ADMIN')
  @Get('backup/export')
  export(@Res() res: Response) {
    const p = dbPath();
    const stamp = new Date().toISOString().slice(0, 10);
    return res.download(p, `dental-backup-${stamp}.db`);
  }
}

@Module({ providers: [SystemService], controllers: [SystemController] })
export class SystemModule {}
