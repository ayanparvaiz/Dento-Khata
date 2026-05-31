import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const SAFE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: 'asc' } });
    return users.map((u) => ({ ...u, permissions: this.parse(u.permissions) }));
  }

  private parse(p?: string | null): string[] {
    try { return JSON.parse(p || '[]'); } catch { return []; }
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) throw new BadRequestException('Username already taken');

    const u = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await bcrypt.hash(dto.password, 10),
        fullName: dto.fullName,
        role: dto.role,
        permissions: dto.role === 'ADMIN' ? null : JSON.stringify(dto.permissions ?? []),
      },
      select: SAFE_SELECT,
    });
    return { ...u, permissions: this.parse(u.permissions) };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.permissions !== undefined) data.permissions = JSON.stringify(dto.permissions);

    const u = await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
    return { ...u, permissions: this.parse(u.permissions) };
  }

  async remove(id: string, requesterId: string) {
    if (id === requesterId) throw new BadRequestException('You cannot delete your own account');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    // Soft-deactivate instead of hard delete to preserve audit/appointment links.
    return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: SAFE_SELECT });
  }
}
