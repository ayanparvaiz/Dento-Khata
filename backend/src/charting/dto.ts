import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Standard dental chart conditions (matches what Dentrix/Open Dental track per tooth).
export const CONDITIONS = [
  'CARIES',
  'FILLED',
  'CROWN',
  'BRIDGE',
  'RCT',
  'IMPLANT',
  'MISSING',
  'EXTRACTED',
  'FRACTURED',
  'SEALANT',
  'VENEER',
  'IMPACTED',
  'HEALTHY',
];
export const SURFACES = ['M', 'D', 'O', 'I', 'B', 'L']; // mesial, distal, occlusal, incisal, buccal, lingual
export const STATUSES = ['EXISTING', 'PLANNED', 'COMPLETED'];

export class CreateToothRecordDto {
  @IsString() toothNumber: string; // FDI, e.g. "11", "48", primary "55"
  @IsOptional() @IsIn(SURFACES) surface?: string;
  @IsIn(CONDITIONS) condition: string;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() note?: string;
}

export class UpdateToothRecordDto {
  @IsOptional() @IsIn(CONDITIONS) condition?: string;
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() note?: string;
}

export class PerioDto {
  @IsString() toothNumber: string;
  @IsOptional() @IsString() pocketDepth?: string; // JSON "[3,2,3,2,3,2]" (6 points)
  @IsOptional() @IsString() bleeding?: string;
  @IsOptional() @IsString() recession?: string;
  @IsOptional() @IsInt() @Min(0) @Max(3) mobility?: number;
  @IsOptional() @IsInt() @Min(0) @Max(3) furcation?: number;
}
