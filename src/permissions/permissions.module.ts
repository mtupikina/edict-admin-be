import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { Role, RoleSchema } from './schemas/role.schema';
import { RolePermission, RolePermissionSchema } from './schemas/role-permission.schema';
import { PermissionsService } from './permissions.service';
import { PermissionsController, RolesController } from './permissions.controller';
import { UsersModule } from '../users/users.module';
import { RequirePermissionsGuard } from '../auth/guards/require-permissions.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
      { name: RolePermission.name, schema: RolePermissionSchema },
    ]),
    forwardRef(() => UsersModule),
  ],
  controllers: [PermissionsController, RolesController],
  providers: [PermissionsService, RequirePermissionsGuard],
  exports: [PermissionsService, RequirePermissionsGuard],
})
export class PermissionsModule {}
