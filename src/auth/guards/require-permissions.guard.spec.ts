import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../permissions/permissions.service';
import { UsersService } from '../../users/users.service';
import { RequirePermissionsGuard } from './require-permissions.guard';

describe('RequirePermissionsGuard', () => {
  let guard: RequirePermissionsGuard;

  const mockReflector = {
    get: jest.fn(),
  };

  const mockPermissionsService = {
    getPermissionsForRoles: jest.fn().mockResolvedValue(['a', 'b']),
    hasPermission: jest.fn().mockReturnValue(true),
  };

  const mockUserWithRoleIds = {
    email: 'u@x.com',
    roleIds: [{ _id: 'role-1', name: 'admin' }],
  };
  const mockUsersService = {
    findOneByEmail: jest.fn().mockResolvedValue(mockUserWithRoleIds),
  };

  function createMockContext(request: { user?: { email: string } }): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  beforeEach(async () => {
    mockUsersService.findOneByEmail.mockResolvedValue(mockUserWithRoleIds);
    mockPermissionsService.hasPermission.mockReturnValue(true);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequirePermissionsGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: PermissionsService, useValue: mockPermissionsService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    guard = module.get<RequirePermissionsGuard>(RequirePermissionsGuard);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow when no required permissions are set', async () => {
    mockReflector.get.mockReturnValue(undefined);
    const ctx = createMockContext({ user: { email: 'u@x.com' } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockUsersService.findOneByEmail).not.toHaveBeenCalled();
  });

  it('should allow when required permissions is empty array', async () => {
    mockReflector.get.mockReturnValue([]);
    const ctx = createMockContext({ user: { email: 'u@x.com' } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when request has no user', async () => {
    mockReflector.get.mockReturnValue(['a']);
    const ctx = createMockContext({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Not authenticated');
    expect(mockUsersService.findOneByEmail).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user has no email', async () => {
    mockReflector.get.mockReturnValue(['a']);
    const ctx = createMockContext({ user: {} as { email: string } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    expect(mockUsersService.findOneByEmail).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user not found', async () => {
    mockReflector.get.mockReturnValue(['a']);
    mockUsersService.findOneByEmail.mockResolvedValue(null);
    const ctx = createMockContext({ user: { email: 'unknown@x.com' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('User not found');
    expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith('unknown@x.com');
  });

  it('should throw ForbiddenException when user has insufficient permissions', async () => {
    mockReflector.get.mockReturnValue(['required:permission']);
    mockPermissionsService.hasPermission.mockReturnValue(false);
    const ctx = createMockContext({ user: { email: 'u@x.com' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Insufficient permissions');
    expect(mockPermissionsService.getPermissionsForRoles).toHaveBeenCalledWith(['admin']);
    expect(mockPermissionsService.hasPermission).toHaveBeenCalled();
  });

  it('should allow when user has at least one required permission', async () => {
    mockReflector.get.mockReturnValue(['a', 'b']);
    mockPermissionsService.hasPermission.mockImplementation((perms: string[], p: string) =>
      perms.includes(p),
    );
    const ctx = createMockContext({ user: { email: 'u@x.com' } });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith('u@x.com');
    expect(mockPermissionsService.getPermissionsForRoles).toHaveBeenCalledWith(['admin']);
    expect(mockPermissionsService.hasPermission).toHaveBeenCalled();
  });
});
