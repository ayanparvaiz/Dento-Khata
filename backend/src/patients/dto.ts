import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePatientDto {
  @IsString() @MinLength(2) fullName: string;
  @IsOptional() @IsIn(['MALE', 'FEMALE', 'OTHER']) gender?: string;
  @IsOptional() @IsString() dateOfBirth?: string; // ISO date
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsIn(['SINGLE', 'MARRIED', 'OTHER']) maritalStatus?: string;
  @IsOptional() @IsString() referralSource?: string;
  @IsOptional() @IsString() emergencyName?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @IsString() guardianName?: string;
}

export class UpdatePatientDto extends CreatePatientDto {
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
