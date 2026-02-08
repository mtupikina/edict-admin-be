import { IsEmail, IsEnum, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '../schemas/user.schema';

/** Roles that can be assigned via API (excludes SUPER_ADMIN) */
export const ApiUserRole = {
  [UserRole.STUDENT]: UserRole.STUDENT,
  [UserRole.TEACHER]: UserRole.TEACHER,
  [UserRole.ADMIN]: UserRole.ADMIN,
} as const;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(ApiUserRole)
  role: UserRole;
}
