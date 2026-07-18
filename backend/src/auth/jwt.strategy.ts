import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './current-user.decorator';
import { clinicSuspended } from './suspended';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    // Re-check the user still exists and is active on every request (scoped to the token's tenant).
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account inactive');
    // If the super-admin disabled the whole clinic, block every active session immediately.
    const tenant = await this.prisma.tenant.findUnique({ where: { id: user.tenantId } });
    if (!tenant || !tenant.isActive) throw clinicSuspended();
    return {
      id: user.id,
      username: user.username ?? user.phone,
      role: user.role,
      fullName: user.fullName,
      tenantId: payload.tenantId ?? user.tenantId,
    };
  }
}
