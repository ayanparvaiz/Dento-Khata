import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { SuperAdminGuard } from './superadmin.guard';
import { Public } from '../auth/public.decorator';
import { SuperLoginDto, GrantDaysDto, CreateTenantAdminDto, ResetUserDto } from './dto';
import { currentStore } from '../tenant/tenant-context';

// Platform-operator console. All routes are @Public (skip the tenant JWT guard) and
// instead protected by SuperAdminGuard, which requires a super-admin token.
@Controller('superadmin')
export class SuperAdminController {
  constructor(private svc: SuperAdminService) {}

  @Public()
  @Post('login')
  login(@Body() dto: SuperLoginDto) {
    return this.svc.login(dto.username, dto.password);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('tenants')
  tenants() {
    return this.svc.listTenants();
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('metrics')
  metrics() {
    return this.svc.metrics();
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('analytics')
  analytics() {
    return this.svc.analytics();
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('payments/pending')
  pending() {
    return this.svc.pendingPayments();
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('payments/:id/verify')
  verify(@Param('id') id: string) {
    return this.svc.verifyPayment(id, currentStore()?.userId || '');
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('payments/:id/reject')
  reject(@Param('id') id: string) {
    return this.svc.rejectPayment(id, currentStore()?.userId || '');
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('grant')
  grant(@Body() dto: GrantDaysDto) {
    return this.svc.grantDays(dto, currentStore()?.userId || '');
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('tenants/:id/suspend')
  suspend(@Param('id') id: string) {
    return this.svc.suspendTenant(id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('tenants/:id/activate')
  activate(@Param('id') id: string) {
    return this.svc.activateTenant(id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('tenants')
  createTenant(@Body() dto: CreateTenantAdminDto) {
    return this.svc.createTenant(dto);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get('tenants/:id/users')
  tenantUsers(@Param('id') id: string) {
    return this.svc.listTenantUsers(id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post('users/:id/reset')
  resetUser(@Param('id') id: string, @Body() dto: ResetUserDto) {
    return this.svc.resetUser(id, dto);
  }
}
