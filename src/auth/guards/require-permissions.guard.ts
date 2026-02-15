import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsService } from '../../permissions/permissions.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class RequirePermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string[]>(REQUIRE_PERMISSIONS_KEY, context.getHandler());
    if (!required?.length) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: { email: string } }>();
    const payload = request.user;
    if (!payload?.email) {
      throw new ForbiddenException('Not authenticated');
    }
    const user = await this.usersService.findOneByEmail(payload.email);
    if (!user) {
      throw new ForbiddenException('User not found');
    }
    const roleName = user.role as string;
    const permissions = await this.permissionsService.getPermissionsForRole(roleName);
    const hasAny = required.some((p) => this.permissionsService.hasPermission(permissions, p));
    if (!hasAny) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
