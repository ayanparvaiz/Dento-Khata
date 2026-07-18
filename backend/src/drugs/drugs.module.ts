import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

class DrugDto {
  @IsString() name: string;
  @IsOptional() @IsString() generic?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() form?: string;
  @IsOptional() @IsString() strength?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@Injectable()
class DrugsService {
  constructor(private prisma: PrismaService) { }
  async findAll(search?: string) {
    if (!search) {
      return this.prisma.drug.findMany({
        where: { isActive: true },
        orderBy: [{ generic: 'asc' }, { name: 'asc' }],
      });
    }
    // Prefix-match the brand name (avoids "Napa" matching "TeNAPAm"), then pull the
    // same-generic ALTERNATIVES. e.g. "Napa" -> Paracetamol brands; "Tory" -> Etoricoxib brands.
    // NOTE: Postgres string matching is case-SENSITIVE by default → use mode:'insensitive'
    // (SQLite's LIKE was case-insensitive, so this only mattered after the Postgres switch).
    const brandMatches = await this.prisma.drug.findMany({
      where: { isActive: true, name: { startsWith: search, mode: 'insensitive' } },
      select: { generic: true },
    });
    const generics = [...new Set(brandMatches.map((d) => d.generic).filter(Boolean))] as string[];
    const rows = await this.prisma.drug.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { startsWith: search, mode: 'insensitive' } }, // brand starts with query
          { generic: { startsWith: search, mode: 'insensitive' } }, // searching by generic name
          ...(generics.length ? [{ generic: { in: generics } }] : []), // alternatives
        ],
      },
    });
    // Rank what the user typed FIRST, then same-generic alternatives.
    // e.g. "napa" -> Napa (exact) on top, not Naproxen brands that merely start with "napa".
    const q = search.toLowerCase();
    const score = (d: { name: string; generic: string | null }) => {
      const n = d.name.toLowerCase();
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      if ((d.generic || '').toLowerCase().startsWith(q)) return 2;
      return 3; // alternative (same generic as a brand match)
    };
    return rows.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  }
  create(dto: DrugDto) {
    return this.prisma.drug.create({ data: dto });
  }
  update(id: string, dto: Partial<DrugDto>) {
    return this.prisma.drug.update({ where: { id }, data: dto });
  }
  remove(id: string) {
    // soft-delete: hide from lists but keep references intact
    return this.prisma.drug.update({ where: { id }, data: { isActive: false } });
  }
}

@Controller('drugs')
class DrugsController {
  constructor(private svc: DrugsService) { }
  @Get()
  findAll(@Query('search') search?: string) {
    return this.svc.findAll(search);
  }
  @UseGuards(RolesGuard) @Roles('ADMIN') @Post()
  create(@Body() dto: DrugDto) {
    return this.svc.create(dto);
  }
  @UseGuards(RolesGuard) @Roles('ADMIN') @Patch(':id')
  update(@Param('id') id: string, @Body() dto: DrugDto) {
    return this.svc.update(id, dto);
  }
  @UseGuards(RolesGuard) @Roles('ADMIN') @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({ providers: [DrugsService], controllers: [DrugsController] })
export class DrugsModule { }
