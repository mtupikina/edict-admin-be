import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AuthExceptionFilter } from './auth-exception.filter';

describe('AuthExceptionFilter', () => {
  let filter: AuthExceptionFilter;
  let mockResponse: { redirect: jest.Mock; status: jest.Mock; json: jest.Mock };

  beforeEach(() => {
    filter = new AuthExceptionFilter();
    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  const createHost = (url: string) =>
    ({
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({ url }),
      }),
    }) as unknown as ArgumentsHost;

  it('should redirect to frontend with error on auth callback failure', () => {
    const host = createHost('/auth/google/callback');
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    filter.catch(new Error('Auth failed'), host);
    expect(mockResponse.redirect).toHaveBeenCalledWith(
      `${frontendUrl}/auth/callback?error=unauthorized`,
    );
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  it('should return JSON with status and message for non-callback requests', () => {
    const host = createHost('/auth/logout');
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exception, host);
    expect(mockResponse.redirect).not.toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(403);
    expect(mockResponse.json).toHaveBeenCalledWith('Forbidden');
  });

  it('should return 500 for non-HttpException', () => {
    const host = createHost('/some/route');
    filter.catch(new Error('Unexpected'), host);
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith('Internal server error');
  });
});
