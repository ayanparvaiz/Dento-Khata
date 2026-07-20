import { IsString, MinLength, IsOptional } from 'class-validator';

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
  @MinLength(6)
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
