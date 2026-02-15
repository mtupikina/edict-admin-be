import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequirePermissionsGuard } from '../auth/guards/require-permissions.guard';
import { Permissions } from '../permissions/constants/permissions.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RequirePermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(Permissions.USERS_WRITE)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @RequirePermissions(Permissions.USERS_READ)
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permissions.USERS_READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permissions.USERS_WRITE)
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @RequirePermissions(Permissions.USERS_WRITE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
