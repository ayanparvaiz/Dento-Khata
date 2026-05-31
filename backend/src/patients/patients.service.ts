import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, MedicalHistoryDto, UpdatePatientDto } from './dto';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // Sequential human-readable code: P-00001, P-00002 ...
  private async nextCode(): Promise<string> {
    const last = await this.prisma.patient.findFirst({
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const n = last ? parseInt(last.code.replace(/\D/g, ''), 10) + 1 : 1;
    return `P-${String(n).padStart(5, '0')}`;
  }

  private toData(dto: CreatePatientDto) {
    return {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    };
  }

  async create(dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: { code: await this.nextCode(), ...this.toData(dto) },
    });
  }

  async findAll(search?: string, page = 1, pageSize = 20) {
    const where = search
      ? {
          isActive: true,
          OR: [
            { fullName: { contains: search } },
            { phone: { contains: search } },
            { code: { contains: search } },
          ],
        }
      : { isActive: true };

    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: {
        medicalHistory: true,
        _count: {
          select: {
            appointments: true,
            prescriptions: true,
            invoices: true,
            toothRecords: true,
            files: true,
          },
        },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    const { isActive, ...rest } = dto;
    return this.prisma.patient.update({
      where: { id },
      data: { ...this.toData(rest), ...(isActive !== undefined ? { isActive } : {}) },
    });
  }

  async upsertMedicalHistory(patientId: string, dto: MedicalHistoryDto) {
    await this.findOne(patientId);
    return this.prisma.medicalHistory.upsert({
      where: { patientId },
      update: dto,
      create: { patientId, ...dto },
    });
  }
}
