/**
 * Permission names stored in DB. Use these constants to avoid typos.
 * When adding new permissions, add here and seed the DB.
 */
export const Permissions = {
  WORDS_READ: 'words:read',
  WORDS_WRITE: 'words:write',
  TESTS_READ: 'tests:read',
  TESTS_WRITE: 'tests:write',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  PERMISSIONS_READ: 'permissions:read',
  PERMISSIONS_WRITE: 'permissions:write',
} as const;

export type PermissionName = (typeof Permissions)[keyof typeof Permissions];

export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
