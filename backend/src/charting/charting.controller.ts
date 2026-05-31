import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ChartingService } from './charting.service';
import { CreateToothRecordDto, PerioDto, UpdateToothRecordDto } from './dto';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@Controller()
export class ChartingController {
  constructor(private charting: ChartingService) {}

  @Get('patients/:id/chart')
  getChart(@Param('id') id: string) {
    return this.charting.getChart(id);
  }

  @Post('patients/:id/chart')
  add(@Param('id') id: string, @Body() dto: CreateToothRecordDto, @CurrentUser() user: AuthUser) {
    return this.charting.addToothRecord(id, dto, user.id);
  }

  @Patch('chart/:recordId')
  update(@Param('recordId') recordId: string, @Body() dto: UpdateToothRecordDto) {
    return this.charting.updateToothRecord(recordId, dto);
  }

  @Delete('chart/:recordId')
  remove(@Param('recordId') recordId: string) {
    return this.charting.deleteToothRecord(recordId);
  }

  @Put('patients/:id/perio')
  savePerio(@Param('id') id: string, @Body() dto: PerioDto) {
    return this.charting.savePerio(id, dto);
  }
}
