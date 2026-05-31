import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto';

const SINGLETON_ID = 'clinic';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  // Always returns the single settings row, creating it on first access.
  get() {
    return this.prisma.clinicSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  }

  update(dto: UpdateSettingsDto) {
    return this.prisma.clinicSettings.upsert({
      where: { id: SINGLETON_ID },
      update: dto,
      create: { id: SINGLETON_ID, ...dto },
    });
  }
}
