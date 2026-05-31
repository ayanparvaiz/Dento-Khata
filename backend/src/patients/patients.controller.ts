import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto, MedicalHistoryDto, UpdatePatientDto } from './dto';

// Any authenticated staff member can manage patients (receptionist, dentist, etc.).
@Controller('patients')
export class PatientsController {
  constructor(private patients: PatientsService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.patients.findAll(search, Number(page) || 1, Number(pageSize) || 20);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patients.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePatientDto) {
    return this.patients.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(id, dto);
  }

  @Put(':id/medical-history')
  upsertMedicalHistory(@Param('id') id: string, @Body() dto: MedicalHistoryDto) {
    return this.patients.upsertMedicalHistory(id, dto);
  }
}
