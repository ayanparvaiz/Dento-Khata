import {
  Controller, Get, Injectable, Module, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

function dbPath(): string {
  // DATABASE_URL like "file:./dental.db" -> resolve relative to cwd
  const url = process.env.DATABASE_URL || 'file:./dental.db';
  const rel = url.replace(/^file:/, '');
  return join(process.cwd(), 'prisma', rel.replace(/^\.\//, ''));
}

@Injectable()
class SystemService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [patients, todayAppointments, pendingTreatments, items, pays] = await Promise.all([
      this.prisma.patient.count({ where: { isActive: true } }),
      this.prisma.appointment.count({ where: { startTime: { gte: start, lt: end } } }),
      this.prisma.treatmentItem.count({ where: { status: 'PLANNED' } }),
      this.prisma.treatmentItem.findMany({ select: { fee: true } }),
      this.prisma.payment.findMany({ select: { amount: true } }),
    ]);
    // Outstanding = total treatment charges − total installments collected.
    const charged = items.reduce((s, i) => s + i.fee, 0);
    const collected = pays.reduce((s, p) => s + p.amount, 0);
    const outstanding = Math.max(0, charged - collected);
    return { patients, todayAppointments, pendingTreatments, outstanding };
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
