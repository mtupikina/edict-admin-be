import { applyUpdatedAtBeforeSave } from './user.schema';

describe('UserSchema hooks', () => {
  describe('applyUpdatedAtBeforeSave', () => {
    it('should set updatedAt and call next', () => {
      const before = new Date('2020-01-01');
      const doc = { updatedAt: before };
      const next = jest.fn();
      applyUpdatedAtBeforeSave.call(doc, next);
      expect(doc.updatedAt).toBeInstanceOf(Date);
      expect(doc.updatedAt!.getTime()).toBeGreaterThan(before.getTime());
      expect(next).toHaveBeenCalledWith();
    });
  });
});
