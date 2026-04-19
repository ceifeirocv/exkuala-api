import { EventEntity, EventStatus } from './event.entity';

describe('EventEntity', () => {
  describe('generateId (BeforeInsert)', () => {
    it('should assign a cuid-format id when id is not set', () => {
      const event = new EventEntity();
      expect(event.id).toBeUndefined();

      event.generateId();

      expect(event.id).toBeDefined();
      expect(typeof event.id).toBe('string');
      expect(event.id.length).toBeGreaterThanOrEqual(20);
      expect(event.id.length).toBeLessThanOrEqual(30);
    });

    it('should NOT overwrite an existing id', () => {
      const event = new EventEntity();
      event.id = 'test-known-id-12345';

      event.generateId();

      expect(event.id).toBe('test-known-id-12345');
    });
  });

  describe('EventStatus enum', () => {
    it('should have DRAFT, PUBLISHED, and CANCELLED values', () => {
      expect(EventStatus.DRAFT).toBe('DRAFT');
      expect(EventStatus.PUBLISHED).toBe('PUBLISHED');
      expect(EventStatus.CANCELLED).toBe('CANCELLED');
    });
  });

  describe('field shape', () => {
    it('should have soft-delete and required fields', () => {
      const event = new EventEntity();
      // Verify the entity exposes all required properties
      expect('id' in event).toBe(true);
      expect('title' in event).toBe(true);
      expect('status' in event).toBe(true);
      expect('deletedAt' in event).toBe(true);
      expect('organizerId' in event).toBe(true);
    });
  });
});
