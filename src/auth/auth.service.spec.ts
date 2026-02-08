import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { TokenBlacklist } from './schemas/token-blacklist.schema';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    isUserAllowed: jest.fn().mockResolvedValue(true),
  };

  const tokenBlacklistChain = (result: unknown) => ({
    exec: jest.fn().mockResolvedValue(result),
  });
  const mockTokenBlacklistModel = {
    findOne: jest.fn().mockReturnValue(tokenBlacklistChain(null)),
    create: jest.fn().mockResolvedValue({}),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-token'),
    verify: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: getModelToken(TokenBlacklist.name),
          useValue: mockTokenBlacklistModel,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateGoogleUser', () => {
    it('should return user when email is allowed', async () => {
      const profile = { emails: [{ value: 'admin@example.com' }], id: 'google-123' };
      const result = await service.validateGoogleUser(profile);
      expect(result).toEqual({ email: 'admin@example.com', googleId: 'google-123' });
    });

    it('should return null when email is not allowed', async () => {
      mockUsersService.isUserAllowed.mockResolvedValueOnce(false);
      const profile = { emails: [{ value: 'other@example.com' }], id: 'google-456' };
      const result = await service.validateGoogleUser(profile);
      expect(result).toBeNull();
    });

    it('should return null when profile has no email', async () => {
      const profile = { id: 'google-789' };
      const result = await service.validateGoogleUser(profile);
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token', async () => {
      const user = { email: 'admin@example.com', googleId: 'google-123' };
      const result = await service.login(user);
      expect(result).toEqual({ access_token: 'mock-token' });
      expect(mockJwtService.sign).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should blacklist token', async () => {
      await service.logout('valid-token');
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockTokenBlacklistModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'valid-token', expiresAt: expect.any(Date) }),
      );
    });

    it('should use default expiry when token has no exp', async () => {
      mockJwtService.verify.mockReturnValueOnce({});
      await service.logout('token');
      expect(mockTokenBlacklistModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token',
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      mockJwtService.verify.mockImplementationOnce(() => {
        throw new Error('invalid');
      });
      await expect(service.logout('bad-token')).rejects.toThrow(UnauthorizedException);
      expect(mockTokenBlacklistModel.create).not.toHaveBeenCalled();
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return false when token not in blacklist', async () => {
      const result = await service.isTokenBlacklisted('some-token');
      expect(result).toBe(false);
    });

    it('should return true when token is blacklisted', async () => {
      mockTokenBlacklistModel.findOne.mockReturnValueOnce(tokenBlacklistChain({ token: 'x' }));
      const result = await service.isTokenBlacklisted('some-token');
      expect(result).toBe(true);
    });
  });
});
