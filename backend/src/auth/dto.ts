import { IsString, MinLength, IsOptional, Matches } from 'class-validator';

// Valid Bangladeshi mobile: 11 digits starting 01 (e.g. 01712345678).
export const BD_PHONE = /^01\d{9}$/;
export const BD_PHONE_MSG = 'ফোন নম্বর ০১ দিয়ে শুরু হয়ে ১১ সংখ্যার হতে হবে (যেমন 01712345678)';

export class LoginDto {
  // Login is by phone number (globally unique) + password. No clinic code needed.
  @IsString()
  @MinLength(6)
  phone: string;

  @IsString()
  password: string;
}

export class SignupDto {
  @IsString()
  @MinLength(2)
  clinicName: string;

  @IsString()
  @MinLength(2)
  ownerName: string;

  // Owner's phone — becomes the login id for the clinic account.
  @IsString()
  @Matches(BD_PHONE, { message: BD_PHONE_MSG })
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  // Meta ad attribution (sent by the browser pixel) — optional.
  @IsOptional() @IsString() fbp?: string;
  @IsOptional() @IsString() fbc?: string;
  @IsOptional() @IsString() eventId?: string; // shared with the browser CompleteRegistration
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
