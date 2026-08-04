import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { INSENSITIVE } from '../config/mode';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto, MedicalHistoryDto, UpdatePatientDto } from './dto';
import { isPaidSub, FREE_LIMITS } from '../subscription/plans';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  // FREE tier is capped at FREE_LIMITS.patients; Pro is unlimited.
  private async assertPatientQuota() {
    const sub = await this.prisma.subscription.findFirst();
    if (isPaidSub(sub)) return;
    const count = await this.prisma.patient.count();
    if (count >= FREE_LIMITS.patients) {
      throw new ForbiddenException({
        code: 'FREE_LIMIT_PATIENTS',
        limit: FREE_LIMITS.patients,
        message: `ফ্রি প্ল্যানে সর্বোচ্চ ${FREE_LIMITS.patients} জন রোগী। আরও রোগী যোগ করতে প্রো-তে আপগ্রেড করুন।`,
      });
    }
  }

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
    await this.assertPatientQuota();
    return this.prisma.patient.create({
      data: { code: await this.nextCode(), ...this.toData(dto) },
    });
  }

  async findAll(search?: string, page = 1, pageSize = 20) {
    const where = search
      ? {
          isActive: true,
          OR: [
            { fullName: { contains: search, ...INSENSITIVE } },
            { phone: { contains: search, ...INSENSITIVE } },
            { code: { contains: search, ...INSENSITIVE } },
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
    // Only touch fields actually present — a partial PATCH (e.g. just behaviourGrade)
    // must not wipe unspecified fields like dateOfBirth.
    const { dateOfBirth, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    return this.prisma.patient.update({ where: { id }, data });
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
