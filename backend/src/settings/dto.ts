import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() logoPath?: string;
  @IsOptional() @IsString() letterhead?: string;
  @IsOptional() @IsString() headerTitle?: string;
  @IsOptional() @IsString() headerSubtitle?: string;
  @IsOptional() @IsString() headerExtra?: string;
  @IsOptional() @IsString() footerLeft?: string;
  @IsOptional() @IsString() footerRight?: string;
  @IsOptional() @IsString() themeColor?: string;
  @IsOptional() @IsIn(['FDI', 'UNIVERSAL', 'PALMER']) toothNotation?: string;
  @IsOptional() @IsString() currency?: string;
}
