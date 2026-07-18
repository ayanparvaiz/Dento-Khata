import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, SignupDto, ChangePasswordDto } from './dto';
import { Public } from './public.decorator';
import { NoSubscription } from '../subscription/no-subscription.decorator';
import { CurrentUser, AuthUser } from './current-user.decorator';

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
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
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
