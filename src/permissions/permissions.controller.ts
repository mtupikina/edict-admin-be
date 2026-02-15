import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequirePermissionsGuard } from '../auth/guards/require-permissions.guard';
import { Permissions } from './constants/permissions.constants';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetRolePermissionsDto } from './dto/set-role-permissions.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(Permissions.PERMISSIONS_READ)
  findAllPermissions() {
    return this.permissionsService.findAllPermissions();
  }

  @Post()
  @RequirePermissions(Permissions.PERMISSIONS_WRITE)
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.createPermission(dto);
  }

  @Get(':id')
  @RequirePermissions(Permissions.PERMISSIONS_READ)
  findOnePermission(@Param('id') id: string) {
    return this.permissionsService.findOnePermission(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.PERMISSIONS_WRITE)
  updatePermission(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.PERMISSIONS_WRITE)
  removePermission(@Param('id') id: string) {
    return this.permissionsService.removePermission(id);
  }
}

@Controller('roles')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class RolesController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get()
  @RequirePermissions(Permissions.ROLES_READ)
  findAllRoles() {
    return this.permissionsService.findAllRoles();
  }

  @Post()
  @RequirePermissions(Permissions.ROLES_WRITE)
  createRole(@Body() dto: CreateRoleDto) {
    return this.permissionsService.createRole(dto);
  }

  @Get(':id/permissions')
  @RequirePermissions(Permissions.ROLES_READ)
  getRolePermissions(@Param('id') id: string) {
    return this.permissionsService.getRolePermissions(id);
  }

  @Patch(':id/permissions')
  @RequirePermissions(Permissions.ROLES_WRITE)
  setRolePermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.permissionsService.setRolePermissions(id, dto.permissionIds);
  }

  @Get(':id')
  @RequirePermissions(Permissions.ROLES_READ)
  findOneRole(@Param('id') id: string) {
    return this.permissionsService.findOneRole(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.ROLES_WRITE)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.permissionsService.updateRole(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.ROLES_WRITE)
  removeRole(@Param('id') id: string) {
    return this.permissionsService.removeRole(id);
  }
}
