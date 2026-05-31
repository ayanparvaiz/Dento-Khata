import {
  Body, ConflictException, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query,
} from '@nestjs/common';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';

// Clinic working window for slot generation (24h). Adjust per clinic later via settings.
const WORK_START = 10; // 10:00
const WORK_END = 22; // 22:00
const SLOT_MIN = 30;
const pad = (n: number) => String(n).padStart(2, '0');
const hmStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

class CreateApptDto {
  @IsString() patientId: string;
  @IsOptional() @IsString() dentistId?: string;
  @IsOptional() @IsString() chair?: string;
  @IsISO8601() startTime: string;
  @IsISO8601() endTime: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() status?: string;
}
class UpdateApptDto {
  @IsOptional() @IsString() dentistId?: string;
  @IsOptional() @IsString() chair?: string;
  @IsOptional() @IsISO8601() startTime?: string;
  @IsOptional() @IsISO8601() endTime?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() status?: string;
}

@Injectable()
class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  dentists() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: { in: ['DENTIST', 'ADMIN'] } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  // Range query: single day (date) or multi-day (from..to) for the week view.
  byRange(dateStr?: string, fromStr?: string, toStr?: string) {
    let start: Date;
    let end: Date;
    if (fromStr && toStr) {
      start = new Date(fromStr);
      start.setHours(0, 0, 0, 0);
      end = new Date(toStr);
      end.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + 1); // inclusive of `to` day
    } else {
      start = new Date(dateStr || new Date());
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }
    return this.withDue(
      this.prisma.appointment.findMany({
        where: { startTime: { gte: start, lt: end } },
        orderBy: { startTime: 'asc' },
        include: { patient: true, dentist: true },
      }),
    );
  }

  // Attach each patient's outstanding balance (treatment total − installments paid).
  private async withDue(apptsP: Promise<any[]>) {
    const appts = await apptsP;
    const ids = [...new Set(appts.map((a) => a.patientId))];
    if (ids.length === 0) return appts;
    const [items, pays] = await Promise.all([
      this.prisma.treatmentItem.findMany({ where: { plan: { patientId: { in: ids } } }, include: { plan: true } }),
      this.prisma.payment.findMany({ where: { patientId: { in: ids } } }),
    ]);
    const total: Record<string, number> = {};
    for (const i of items) total[i.plan.patientId] = (total[i.plan.patientId] || 0) + i.fee;
    const paid: Record<string, number> = {};
    for (const p of pays) if (p.patientId) paid[p.patientId] = (paid[p.patientId] || 0) + p.amount;
    return appts.map((a) => ({ ...a, due: (total[a.patientId] || 0) - (paid[a.patientId] || 0) }));
  }

  forPatient(patientId: string) {
    return this.prisma.appointment.findMany({
      where: { patientId },
      orderBy: { startTime: 'desc' },
      include: { dentist: true },
    });
  }

  // Reject double-booking: same chair OR same dentist overlapping an active appointment.
  private async assertNoConflict(
    start: Date, end: Date, chair?: string | null, dentistId?: string | null, excludeId?: string,
  ) {
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const sameDay = await this.prisma.appointment.findMany({
      where: {
        startTime: { gte: dayStart, lt: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { patient: true, dentist: true },
    });
    const overlaps = (a: any) => new Date(a.startTime) < end && new Date(a.endTime) > start;
    const chairClash = chair ? sameDay.find((a) => a.chair === chair && overlaps(a)) : undefined;
    if (chairClash) {
      throw new ConflictException(
        `${chair} is already booked ${hmStr(new Date(chairClash.startTime))}–${hmStr(new Date(chairClash.endTime))} (${chairClash.patient.fullName}). Pick another time or chair.`,
      );
    }
    const docClash = dentistId ? sameDay.find((a) => a.dentistId === dentistId && overlaps(a)) : undefined;
    if (docClash) {
      throw new ConflictException(
        `${docClash.dentist?.fullName || 'Dentist'} is busy ${hmStr(new Date(docClash.startTime))}–${hmStr(new Date(docClash.endTime))} (${docClash.patient.fullName}). Pick another time or dentist.`,
      );
    }
  }

  // Free/busy slots (30-min steps). A slot is available only if the FULL
  // appointment duration starting there is free and fits the working day.
  async availability(dateStr: string, chair?: string, dentistId?: string, durMin = SLOT_MIN) {
    const dayStart = new Date(dateStr); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const closing = new Date(dayStart); closing.setHours(WORK_END, 0, 0, 0);
    const appts = await this.prisma.appointment.findMany({
      where: { startTime: { gte: dayStart, lt: dayEnd }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      include: { patient: true },
    });
    // Step the grid BY the duration: 30 min -> 10:00,10:30…  1 hour -> 10:00,11:00…
    const slots: any[] = [];
    const startMin = WORK_START * 60;
    const endMin = WORK_END * 60;
    void closing;
    for (let t = startMin; t + durMin <= endMin; t += durMin) {
      const s = new Date(dayStart); s.setHours(0, t, 0, 0);
      const e = new Date(s); e.setMinutes(e.getMinutes() + durMin);
      const overlap = (a: any) => new Date(a.startTime) < e && new Date(a.endTime) > s;
      const chairBusy = chair ? appts.find((a) => a.chair === chair && overlap(a)) : undefined;
      const docBusy = dentistId ? appts.find((a) => a.dentistId === dentistId && overlap(a)) : undefined;
      const clash = chairBusy || docBusy;
      slots.push({
        start: hmStr(s),
        end: hmStr(e),
        available: !clash,
        by: clash ? (clash as any).patient?.fullName : undefined,
        reason: chairBusy ? 'chair' : docBusy ? 'dentist' : undefined,
      });
    }
    return { date: dateStr, chair, dentistId, slots };
  }

  // Free-slot COUNT per day over N days — powers the "which date has openings" strip.
  async availabilityRange(fromStr: string, days: number, chair?: string, dentistId?: string, durMin = SLOT_MIN) {
    const start = new Date(fromStr); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + days);
    const appts = await this.prisma.appointment.findMany({
      where: { startTime: { gte: start, lt: end }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    const startMin = WORK_START * 60;
    const endMin = WORK_END * 60;
    const out: any[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      let free = 0;
      let total = 0;
      for (let t = startMin; t + durMin <= endMin; t += durMin) {
        total++;
        const s = new Date(d); s.setHours(0, t, 0, 0);
        const e = new Date(s); e.setMinutes(e.getMinutes() + durMin);
        const overlap = (a: any) => new Date(a.startTime) < e && new Date(a.endTime) > s;
        const busy =
          (chair && appts.some((a) => a.chair === chair && overlap(a))) ||
          (dentistId && appts.some((a) => a.dentistId === dentistId && overlap(a)));
        if (!busy) free++;
      }
      out.push({ date: localDate(d), free, total });
    }
    return out;
  }

  async create(dto: CreateApptDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    await this.assertNoConflict(start, end, dto.chair, dto.dentistId);
    return this.prisma.appointment.create({
      data: {
        patientId: dto.patientId,
        dentistId: dto.dentistId,
        chair: dto.chair,
        startTime: start,
        endTime: end,
        reason: dto.reason,
        status: dto.status ?? 'BOOKED',
      },
      include: { patient: true, dentist: true },
    });
  }

  async update(id: string, dto: UpdateApptDto) {
    const current = await this.prisma.appointment.findUnique({ where: { id } });
    const start = dto.startTime ? new Date(dto.startTime) : current!.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : current!.endTime;
    const chair = dto.chair ?? current!.chair;
    const dentistId = dto.dentistId ?? current!.dentistId;
    // Only re-check conflicts when time/chair/dentist changes (status-only edits skip it).
    if (dto.startTime || dto.endTime || dto.chair || dto.dentistId) {
      await this.assertNoConflict(start, end, chair, dentistId, id);
    }
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startTime ? { startTime: start } : {}),
        ...(dto.endTime ? { endTime: end } : {}),
      },
      include: { patient: true, dentist: true },
    });
  }

  remove(id: string) {
    return this.prisma.appointment.delete({ where: { id } });
  }
}

@Controller('appointments')
class AppointmentsController {
  constructor(private svc: AppointmentsService) {}
  @Get('dentists')
  dentists() {
    return this.svc.dentists();
  }
  @Get('patient/:patientId')
  forPatient(@Param('patientId') patientId: string) {
    return this.svc.forPatient(patientId);
  }
  @Get('availability')
  availability(
    @Query('date') date: string,
    @Query('chair') chair?: string,
    @Query('dentistId') dentistId?: string,
    @Query('dur') dur?: string,
  ) {
    return this.svc.availability(date, chair, dentistId, Number(dur) || 30);
  }
  @Get('availability-range')
  availabilityRange(
    @Query('from') from: string,
    @Query('days') days?: string,
    @Query('chair') chair?: string,
    @Query('dentistId') dentistId?: string,
    @Query('dur') dur?: string,
  ) {
    return this.svc.availabilityRange(from, Number(days) || 14, chair, dentistId, Number(dur) || 30);
  }
  @Get()
  byRange(@Query('date') date?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.byRange(date, from, to);
  }
  @Post()
  create(@Body() dto: CreateApptDto) {
    return this.svc.create(dto);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApptDto) {
    return this.svc.update(id, dto);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({ providers: [AppointmentsService], controllers: [AppointmentsController] })
export class AppointmentsModule {}
