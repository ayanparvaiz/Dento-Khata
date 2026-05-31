import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() logoPath?: string;
  @IsOptional() @IsString() letterhead?: string;
  @IsOptional() @IsIn(['FDI', 'UNIVERSAL', 'PALMER']) toothNotation?: string;
  @IsOptional() @IsString() currency?: string;
}
