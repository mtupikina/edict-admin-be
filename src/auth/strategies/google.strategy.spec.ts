import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleStrategy } from './google.strategy';
import { AuthService } from '../auth.service';

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret';
      if (key === 'GOOGLE_CALLBACK_URL') return 'http://localhost:3000/auth/google/callback';
      return undefined;
    }),
  };

  const mockAuthService = {
    validateGoogleUser: jest.fn().mockResolvedValue({ email: 'a@b.com', googleId: 'g-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should call done with user when allowed', async () => {
      const done = jest.fn();
      const profile = { emails: [{ value: 'a@b.com' }], id: 'g-1' };
      await strategy.validate('access', 'refresh', profile, done);
      expect(mockAuthService.validateGoogleUser).toHaveBeenCalledWith(profile);
      expect(done).toHaveBeenCalledWith(null, { email: 'a@b.com', googleId: 'g-1' });
    });

    it('should call done with error when user not allowed', async () => {
      mockAuthService.validateGoogleUser.mockResolvedValueOnce(null);
      const done = jest.fn();
      const profile = { emails: [{ value: 'x@y.com' }], id: 'g-2' };
      await strategy.validate('access', 'refresh', profile, done);
      expect(done).toHaveBeenCalledWith(expect.any(Error), undefined);
      expect(done.mock.calls[0][0].message).toBe('User not allowed');
    });
  });
});
