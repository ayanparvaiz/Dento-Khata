import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  // Health check — used by clients to confirm the server PC is reachable on the LAN.
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'dental-backend', time: new Date().toISOString() };
  }
}
