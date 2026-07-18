import { IsString, IsInt, Min, Max, IsOptional, MinLength } from 'class-validator';

export class SuperLoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class GrantDaysDto {
  @IsString()
  tenantId: string;

  @IsInt()
  @Min(1)
  @Max(3650)
  days: number; // any number of days (3, 7, 30, …)

  @IsOptional()
  @IsString()
  note?: string;
}

export class ResetUserDto {
  // Support-desk credential reset: set a new phone and/or password for a tenant user.
  @IsOptional()
  @IsString()
  @MinLength(6)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

export class CreateTenantAdminDto {
  // Super-admin can also provision a clinic directly (no self-signup).
  @IsString()
  @MinLength(2)
  clinicName: string;

  @IsOptional()
  @IsString()
  clinicCode?: string;

  @IsString()
  @MinLength(2)
  ownerName: string;

  // Owner login phone (globally unique).
  @IsString()
  @MinLength(6)
  phone: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  @MinLength(6)
  password: string;
}
