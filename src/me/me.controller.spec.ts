// Wave 0 RED stubs — MeController does not yet exist. Imports below fail until Wave 2.
import { MeController } from './me.controller'; // RED: Wave 2 creates this
import { RsvpService } from '../rsvp/rsvp.service'; // RED: Wave 2 creates this
import { RsvpState } from '../rsvp/rsvp.entity'; // RED: Wave 1 creates this
import { AuthenticatedUser } from '../types/auth';

describe('MeController', () => {
  let controller: MeController;
  let mockRsvpService: { listUserRsvps: jest.Mock };

  const mockUser: AuthenticatedUser = { id: 'user-01', auth0Id: 'auth0|123', roles: [] };

  beforeEach(() => {
    mockRsvpService = {
      listUserRsvps: jest.fn(),
    };
    controller = new MeController(mockRsvpService as unknown as RsvpService);
  });

  describe('GET /me/rsvps (listRsvps)', () => {
    it('calls rsvpService.listUserRsvps(user.id, query) and returns result', async () => {
      const mockResult = {
        data: [
          {
            rsvpState: RsvpState.GOING,
            rsvpedAt: new Date('2026-01-01'),
            event: { id: 'evt-01', title: 'Jazz Night', startAt: new Date(), city: 'Praia', imageUrl: null },
          },
        ],
        nextCursor: null,
        hasMore: false,
      };
      mockRsvpService.listUserRsvps.mockResolvedValue(mockResult);

      const result = await controller.listRsvps(mockUser, {});

      expect(result).toEqual(mockResult);
      expect(mockRsvpService.listUserRsvps).toHaveBeenCalledWith('user-01', {});
    });

    it('passes cursor and limit from query params to service', async () => {
      const mockResult = { data: [], nextCursor: null, hasMore: false };
      mockRsvpService.listUserRsvps.mockResolvedValue(mockResult);
      const query = { cursor: 'some-cursor', limit: 10 };

      await controller.listRsvps(mockUser, query);

      expect(mockRsvpService.listUserRsvps).toHaveBeenCalledWith('user-01', query);
    });
  });
});
