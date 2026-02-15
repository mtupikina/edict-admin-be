import { IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
