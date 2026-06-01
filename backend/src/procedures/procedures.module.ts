import { Body, Controller, Delete, Get, Injectable, Param, Patch, Post, Query, UseGuards, Module } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

class ProcedureDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() defaultFee?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
class ProceduresService {
  constructor(private prisma: PrismaService) {}
  findAll(search?: string) {
    return this.prisma.procedure.findMany({
      where: {
        isActive: true,
        ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
      },
      orderBy: { category: 'asc' },
    });
  }
  create(dto: ProcedureDto) {
    return this.prisma.procedure.create({ data: dto });
  }
  update(id: string, dto: Partial<ProcedureDto>) {
    return this.prisma.procedure.update({ where: { id }, data: dto });
  }
  remove(id: string) {
    return this.prisma.procedure.update({ where: { id }, data: { isActive: false } });
  }
}

@Controller('procedures')
class ProceduresController {
  constructor(private svc: ProceduresService) {}
  @Get()
  findAll(@Query('search') search?: string) {
    return this.svc.findAll(search);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  create(@Body() dto: ProcedureDto) {
    return this.svc.create(dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: ProcedureDto) {
    return this.svc.update(id, dto);
  }
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  providers: [ProceduresService],
  controllers: [ProceduresController],
})
export class ProceduresModule {}
