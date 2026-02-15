import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PermissionsService } from '../permissions/permissions.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ access_token: 'mock-token' }),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const mockUsersService = {
    findOneByEmail: jest.fn().mockResolvedValue({ email: 'user@example.com', role: 'admin' }),
  };

  const mockPermissionsService = {
    getPermissionsForRole: jest.fn().mockResolvedValue(['users:read', 'users:write']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('googleAuthCallback', () => {
    it('should redirect with token', async () => {
      const req = { user: { email: 'a@b.com', googleId: 'g-1' } };
      const res = { redirect: jest.fn() };
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

      await controller.googleAuthCallback(req as unknown as Request, res as unknown as Response);

      expect(mockAuthService.login).toHaveBeenCalledWith({ email: 'a@b.com', googleId: 'g-1' });
      expect(res.redirect).toHaveBeenCalledWith(`${frontendUrl}/auth/callback?token=mock-token`);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with token from header', async () => {
      const req = { headers: { authorization: 'Bearer my-token' } };
      const result = await controller.logout(req as unknown as Request);
      expect(mockAuthService.logout).toHaveBeenCalledWith('my-token');
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('should not call logout when no authorization header', async () => {
      const req = { headers: {} };
      const result = await controller.logout(req as unknown as Request);
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('getProfile', () => {
    it('should return email, role and permissions', async () => {
      const user = { email: 'user@example.com', sub: 'sub-1' };
      const result = await controller.getProfile(user);
      expect(mockUsersService.findOneByEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockPermissionsService.getPermissionsForRole).toHaveBeenCalledWith('admin');
      expect(result).toEqual({
        email: 'user@example.com',
        role: 'admin',
        permissions: ['users:read', 'users:write'],
      });
    });

    it('should return email and empty role/permissions when user not found', async () => {
      mockUsersService.findOneByEmail.mockResolvedValueOnce(null);
      const user = { email: 'unknown@example.com', sub: 'sub-1' };
      const result = await controller.getProfile(user);
      expect(result).toEqual({ email: 'unknown@example.com', role: null, permissions: [] });
    });
  });
});
