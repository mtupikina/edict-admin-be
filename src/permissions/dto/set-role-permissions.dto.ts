import { IsArray, IsMongoId } from 'class-validator';

export class SetRolePermissionsDto {
  @IsArray()
  @IsMongoId({ each: true })
  permissionIds: string[];
}
