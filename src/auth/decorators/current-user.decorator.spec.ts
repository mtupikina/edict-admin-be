import { ExecutionContext } from '@nestjs/common';
import { CurrentUser, extractCurrentUserFromContext } from './current-user.decorator';
import { JwtPayload } from '../auth.service';

describe('CurrentUser', () => {
  it('should be a param decorator that applies without error', () => {
    const decorator = CurrentUser();
    expect(typeof decorator).toBe('function');
    expect(() => decorator(class {}, 'handler', 0)).not.toThrow();
  });

  describe('extractCurrentUserFromContext', () => {
    it('should return user from the HTTP request', () => {
      const payload: JwtPayload = { email: 'u@e.com', sub: 'sub-1' };
      const ctx = {
        switchToHttp: () => ({
          getRequest: () => ({ user: payload }),
        }),
      } as ExecutionContext;
      expect(extractCurrentUserFromContext(ctx)).toEqual(payload);
    });
  });
});
