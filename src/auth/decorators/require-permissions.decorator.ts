import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';

/**
 * Require at least one of the given permissions.
 * Use after JwtAuthGuard so the user is authenticated.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
