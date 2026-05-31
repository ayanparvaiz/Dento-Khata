import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateToothRecordDto, PerioDto, UpdateToothRecordDto } from './dto';

@Injectable()
export class ChartingService {
  constructor(private prisma: PrismaService) {}

  // Full chart for a patient: every tooth condition mark + perio measurements.
  async getChart(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    const [teeth, perio] = await Promise.all([
      this.prisma.toothRecord.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.perioRecord.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
      }),
    ]);
    return { teeth, perio };
  }

  addToothRecord(patientId: string, dto: CreateToothRecordDto, userId?: string) {
    return this.prisma.toothRecord.create({
      data: {
        patientId,
        toothNumber: dto.toothNumber,
        surface: dto.surface,
        condition: dto.condition,
        status: dto.status ?? 'EXISTING',
        note: dto.note,
        recordedBy: userId,
      },
    });
  }

  async updateToothRecord(id: string, dto: UpdateToothRecordDto) {
    const rec = await this.prisma.toothRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Record not found');
    return this.prisma.toothRecord.update({ where: { id }, data: dto });
  }

  async deleteToothRecord(id: string) {
    const rec = await this.prisma.toothRecord.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Record not found');
    return this.prisma.toothRecord.delete({ where: { id } });
  }

  // Basic perio: upsert one measurement row per tooth (latest wins).
  async savePerio(patientId: string, dto: PerioDto) {
    const existing = await this.prisma.perioRecord.findFirst({
      where: { patientId, toothNumber: dto.toothNumber },
    });
    if (existing) {
      return this.prisma.perioRecord.update({ where: { id: existing.id }, data: dto });
    }
    return this.prisma.perioRecord.create({ data: { patientId, ...dto } });
  }
}
