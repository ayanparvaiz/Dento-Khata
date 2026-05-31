import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // Any authenticated user can read clinic settings (needed for letterhead, notation, etc.).
  @Get()
  get() {
    return this.settings.get();
  }

  // Only ADMIN can change clinic settings.
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }
}
