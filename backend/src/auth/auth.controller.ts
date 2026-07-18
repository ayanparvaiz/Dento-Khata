import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, ChangePasswordDto } from './dto';
import { Public } from './public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';
import { CurrentUser, AuthUser } from './current-user.decorator';

// Real client IP, honouring nginx's X-Forwarded-For.
function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : (fwd || '').split(',')[0];
  return (first || req.ip || (req.socket as any)?.remoteAddress || '').trim();
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.password);
  }

  // Public clinic self-registration → creates tenant + owner + pending subscription.
  @Public()
  @Post('signup')
  signup(@Body() dto: SignupDto, @Req() req: Request) {
    return this.auth.signup(dto, clientIp(req));
  }

  // Returns the currently authenticated user + granted permissions (used on app load).
  // Exempt from the subscription paywall so a blocked tenant can still load the shell + pay screen.
  @NoSubscription()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @NoSubscription()
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
