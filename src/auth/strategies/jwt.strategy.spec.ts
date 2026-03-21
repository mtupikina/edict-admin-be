import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const mockConfigService = {
    get: jest.fn((key: string) =>
      key === 'JWT_SECRET' ? 'test-secret-min-32-characters-long' : undefined,
    ),
  };

  const mockAuthService = {
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('constructor JWT secret default', () => {
    it('should instantiate when JWT_SECRET is unset (development default)', async () => {
      const configNoSecret = {
        get: jest.fn((key: string) => (key === 'JWT_SECRET' ? undefined : undefined)),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: ConfigService, useValue: configNoSecret },
          { provide: AuthService, useValue: mockAuthService },
        ],
      }).compile();
      const s = module.get<JwtStrategy>(JwtStrategy);
      expect(s).toBeDefined();
      expect(configNoSecret.get).toHaveBeenCalledWith('JWT_SECRET');
    });
  });

  describe('validate', () => {
    it('should return payload when token is not blacklisted', async () => {
      const req = { headers: { authorization: 'Bearer token-123' } };
      const payload = { email: 'u@e.com', sub: 'sub-1' };
      const result = await strategy.validate(req as Request, payload);
      expect(mockAuthService.isTokenBlacklisted).toHaveBeenCalledWith('token-123');
      expect(result).toEqual({ email: 'u@e.com', sub: 'sub-1' });
    });

    it('should return payload when no authorization header', async () => {
      const req = { headers: {} };
      const payload = { email: 'u@e.com', sub: 'sub-1' };
      const result = await strategy.validate(req as Request, payload);
      expect(mockAuthService.isTokenBlacklisted).not.toHaveBeenCalled();
      expect(result).toEqual({ email: 'u@e.com', sub: 'sub-1' });
    });

    it('should throw UnauthorizedException when token is blacklisted', async () => {
      mockAuthService.isTokenBlacklisted.mockResolvedValue(true);
      const req = { headers: { authorization: 'Bearer blacklisted' } };
      const payload = { email: 'u@e.com', sub: 'sub-1' };
      const request = req as Request;
      await expect(strategy.validate(request, payload)).rejects.toThrow(UnauthorizedException);
      await expect(strategy.validate(request, payload)).rejects.toThrow(
        'Token has been invalidated',
      );
    });
  });
});
