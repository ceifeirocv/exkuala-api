// Wave 0 RED stubs — EventsRsvpController does not yet exist. Imports below fail until Wave 2.
import { EventsRsvpController } from './events-rsvp.controller'; // RED: Wave 2 creates this
import { RsvpService } from '../rsvp/rsvp.service'; // RED: Wave 2 creates this
import { RsvpState } from '../rsvp/rsvp.entity'; // RED: Wave 1 creates this
import { AuthenticatedUser } from '../types/auth';

describe('EventsRsvpController', () => {
  let controller: EventsRsvpController;
  let mockRsvpService: { upsertRsvp: jest.Mock; cancelRsvp: jest.Mock };

  const mockUser: AuthenticatedUser = { id: 'user-01', auth0Id: 'auth0|123', roles: [] };

  beforeEach(() => {
    mockRsvpService = {
      upsertRsvp: jest.fn(),
      cancelRsvp: jest.fn(),
    };
    controller = new EventsRsvpController(mockRsvpService as unknown as RsvpService);
  });

  describe('POST /events/:id/rsvp (upsertRsvp)', () => {
    it('calls rsvpService.upsertRsvp(user.id, eventId, dto) and returns result', async () => {
      const mockResult = { id: 'rsvp-01', state: RsvpState.INTERESTED, rsvpedAt: new Date('2026-01-01') };
      mockRsvpService.upsertRsvp.mockResolvedValue(mockResult);

      const result = await controller.upsertRsvp(mockUser, 'evt-01', { state: RsvpState.INTERESTED });

      expect(result).toEqual(mockResult);
      expect(mockRsvpService.upsertRsvp).toHaveBeenCalledWith('user-01', 'evt-01', { state: RsvpState.INTERESTED });
    });
  });

  describe('DELETE /events/:id/rsvp (cancelRsvp)', () => {
    it('calls rsvpService.cancelRsvp(user.id, eventId) and returns void', async () => {
      mockRsvpService.cancelRsvp.mockResolvedValue(undefined);

      const result = await controller.cancelRsvp(mockUser, 'evt-01');

      expect(result).toBeUndefined();
      expect(mockRsvpService.cancelRsvp).toHaveBeenCalledWith('user-01', 'evt-01');
    });
  });
});
