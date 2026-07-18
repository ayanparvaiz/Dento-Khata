import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // The current tenant's settings row (scoped by request context), created on first access.
  async get() {
    const existing = await this.prisma.clinicSettings.findFirst();
    if (existing) return existing;
    return this.prisma.clinicSettings.create({ data: {} });
  }

  async update(dto: UpdateSettingsDto) {
    const current = await this.get();
    return this.prisma.clinicSettings.update({ where: { id: current.id }, data: dto });
  }
}
