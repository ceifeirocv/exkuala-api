// Wave 0 RED stub — PublicEventsController does not exist yet.
// This file intentionally fails to compile until Wave 2 creates public-events.controller.ts.
import { NotFoundException } from '@nestjs/common';
import { PublicEventsController } from './public-events.controller'; // RED: file doesn't exist
import { EventsService } from './events.service';
import { PublicEventsQueryDto } from './dto/public-events-query.dto'; // RED: file doesn't exist
import { PublicEventDetailDto } from './dto/public-event-detail.dto'; // RED: file doesn't exist
import { PaginatedPublicEventsResponseDto } from './dto/paginated-public-events-response.dto'; // RED: file doesn't exist

const mockEventsService = {
  findPublished: jest.fn(),
  findPublishedById: jest.fn(),
};

describe('PublicEventsController', () => {
  let controller: PublicEventsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PublicEventsController(mockEventsService as unknown as EventsService);
  });

  describe('GET /events (EVT-04, EVT-06, DISC-01)', () => {
    it('delegates to eventsService.findPublished() and returns paginated result', async () => {
      const query: PublicEventsQueryDto = { limit: 20 };
      const expected: PaginatedPublicEventsResponseDto = { data: [], nextCursor: null, hasMore: false };
      mockEventsService.findPublished.mockResolvedValue(expected);
      const result = await controller.findPublished(query);
      expect(mockEventsService.findPublished).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('propagates NotFoundException when service throws', async () => {
      mockEventsService.findPublished.mockRejectedValue(new NotFoundException());
      await expect(controller.findPublished({})).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /events/:id (EVT-04)', () => {
    it('delegates to eventsService.findPublishedById() and returns detail', async () => {
      const detail = { id: 'evt-01', title: 'Jazz Night' } as unknown as PublicEventDetailDto;
      mockEventsService.findPublishedById.mockResolvedValue(detail);
      const result = await controller.findPublishedById('evt-01');
      expect(mockEventsService.findPublishedById).toHaveBeenCalledWith('evt-01');
      expect(result).toEqual(detail);
    });

    it('propagates NotFoundException for non-published events', async () => {
      mockEventsService.findPublishedById.mockRejectedValue(new NotFoundException());
      await expect(controller.findPublishedById('draft-id')).rejects.toThrow(NotFoundException);
    });
  });
});
