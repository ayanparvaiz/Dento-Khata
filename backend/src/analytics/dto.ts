import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// One engagement report for a landing-page visit. Upserted by `sid`.
export class VisitDto {
  @IsString()
  @MaxLength(64)
  sid!: string;

  @IsOptional() @IsString() @MaxLength(200)
  path?: string;

  @IsOptional() @IsString() @MaxLength(300)
  referrer?: string;

  @IsOptional() @IsString() @MaxLength(80)
  utmSource?: string;

  @IsOptional() @IsString() @MaxLength(120)
  utmCampaign?: string;

  @IsOptional() @IsString() @MaxLength(20)
  device?: string;

  // Total active time on the page, milliseconds.
  @IsOptional() @IsInt() @Min(0) @Max(86_400_000)
  durationMs?: number;

  // Furthest scroll depth reached, 0–100 %.
  @IsOptional() @IsInt() @Min(0) @Max(100)
  maxScroll?: number;

  @IsOptional() @IsBoolean()
  signedUp?: boolean;
}
