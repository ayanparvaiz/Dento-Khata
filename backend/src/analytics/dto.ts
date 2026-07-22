import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// A browser-fired conversion we ALSO want to send server-side (Conversions API) so it
// reliably reaches Meta even when the browser pixel is blocked. Same eventId as the
// pixel → Meta deduplicates. Event name is whitelisted to prevent abuse of this public route.
export class TrackEventDto {
  @IsString()
  @IsIn(['Contact', 'Lead', 'ViewContent', 'InitiateCheckout'])
  event!: string;

  @IsString() @MaxLength(80)
  eventId!: string;

  @IsOptional() @IsString() @MaxLength(300) fbp?: string;
  @IsOptional() @IsString() @MaxLength(300) fbc?: string;
  @IsOptional() @IsString() @MaxLength(300) sourceUrl?: string;
}

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
