import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn().mockResolvedValue({ access_token: 'mock-token' }),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
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
    it('should return user email', () => {
      const user = { email: 'user@example.com', sub: 'sub-1' };
      const result = controller.getProfile(user);
      expect(result).toEqual({ email: 'user@example.com' });
    });
  });
});
