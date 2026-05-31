import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return { access_token: token, user: this.shape(user) };
  }

  // Current user incl. granted permissions (admin = all).
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.shape(user);
  }

  private shape(user: any) {
    let permissions: string[] = [];
    try { permissions = JSON.parse(user.permissions || '[]'); } catch { permissions = []; }
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      permissions, // ASSISTANT's granted caps; ADMIN treated as all on the client
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Current password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10) },
    });
    return { success: true };
  }
}
