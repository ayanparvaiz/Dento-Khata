import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ALL_ROLES } from '../auth/roles';

export class CreateUserDto {
  @IsString() @MinLength(3) username: string;
  @IsString() @MinLength(6) password: string;
  @IsString() fullName: string;
  @IsIn(ALL_ROLES) role: string;
  @IsOptional() @IsArray() permissions?: string[]; // granted capability keys (assistant)
}

export class UpdateUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsIn(ALL_ROLES) role?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsArray() permissions?: string[];
}
