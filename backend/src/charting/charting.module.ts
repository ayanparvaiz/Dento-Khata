import { Module } from '@nestjs/common';
import { ChartingService } from './charting.service';
import { ChartingController } from './charting.controller';

@Module({
  providers: [ChartingService],
  controllers: [ChartingController],
})
export class ChartingModule {}
