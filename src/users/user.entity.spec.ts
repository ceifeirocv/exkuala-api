import { UserEntity } from './user.entity';

describe('UserEntity', () => {
  describe('generateId (BeforeInsert)', () => {
    it('should assign a cuid-format id when id is not set', () => {
      const user = new UserEntity();
      expect(user.id).toBeUndefined();

      user.generateId();

      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
      // cuid2 IDs start with a letter and are 24 chars by default
      expect(user.id.length).toBeGreaterThanOrEqual(20);
      expect(user.id.length).toBeLessThanOrEqual(30);
    });

    it('should NOT overwrite an existing id', () => {
      const user = new UserEntity();
      user.id = 'test-known-id-12345';

      user.generateId();

      expect(user.id).toBe('test-known-id-12345');
    });
  });

  describe('field shape', () => {
    it('should have the expected properties', () => {
      const user = new UserEntity();
      // Verify the entity has the required fields (even if undefined at creation)
      expect('id' in user).toBe(true);
      expect('auth0Id' in user).toBe(true);
    });
  });
});
