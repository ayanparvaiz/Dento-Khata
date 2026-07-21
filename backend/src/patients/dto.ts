import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// BD mobile: 11 digits starting 01 (e.g. 01712345678).
const BD_PHONE = /^01\d{9}$/;

export class CreatePatientDto {
  @IsString() @MinLength(2, { message: 'রোগীর নাম দিন (কমপক্ষে ২ অক্ষর)' }) fullName: string;
  @IsString() @Matches(BD_PHONE, { message: 'সঠিক মোবাইল নম্বর দিন (১১ সংখ্যা, 01 দিয়ে শুরু)' }) phone: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
  @IsOptional() @IsString() dateOfBirth?: string; // ISO date
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsIn(['SINGLE', 'MARRIED', 'OTHER']) maritalStatus?: string;
  @IsOptional() @IsString() referralSource?: string;
  @IsOptional() @IsString() emergencyName?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsIn(['A+', 'A', 'A-', 'F']) behaviourGrade?: string; // patient cooperation grade
}

export class UpdatePatientDto extends CreatePatientDto {
  // All fields optional on update (partial PATCH) — override the required fields.
  @IsOptional() @IsString() @MinLength(2) fullName: string;
  @IsOptional() @IsString() @Matches(BD_PHONE, { message: 'সঠিক মোবাইল নম্বর দিন (১১ সংখ্যা, 01 দিয়ে শুরু)' }) phone: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class MedicalHistoryDto {
  @IsOptional() @IsString() allergies?: string;
  @IsOptional() @IsString() medications?: string;
  @IsOptional() @IsString() conditions?: string;
  @IsOptional() @IsString() habits?: string;
  @IsOptional() @IsString() pastDentalHistory?: string;
  @IsOptional() @IsBoolean() isPregnant?: boolean;
  @IsOptional() @IsBoolean() premedRequired?: boolean;
  @IsOptional() @IsString() notes?: string;
}
