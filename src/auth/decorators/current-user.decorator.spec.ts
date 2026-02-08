import { CurrentUser } from './current-user.decorator';

describe('CurrentUser', () => {
  it('should be a param decorator that applies without error', () => {
    const decorator = CurrentUser();
    expect(typeof decorator).toBe('function');
    expect(() => decorator(class {}, 'handler', 0)).not.toThrow();
  });
});
