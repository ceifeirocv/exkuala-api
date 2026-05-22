import { ApiProperty } from '@nestjs/swagger';
import { RsvpState } from '../rsvp.entity';

/**
 * Single item in GET /me/rsvps data array (D-09, D-11).
 * Slim shape: RSVP state + timestamp + minimal event info.
 * Full PublicEventListItemDto is intentionally excluded — only fields needed for a calendar view.
 *
 * Example:
 * { rsvpState: 'GOING', rsvpedAt: '2026-05-15T10:00:00Z',
 *   event: { id: 'evt-01', title: 'Jazz Night', startAt: '2027-01-01T20:00:00Z', city: 'Praia', imageUrl: null } }
 */
export class RsvpHistoryItemDto {
  @ApiProperty({ enum: RsvpState })
  rsvpState: RsvpState;

  @ApiProperty()
  rsvpedAt: Date;

  @ApiProperty()
  event: {
    id: string;
    title: string;
    startAt: Date;
    city: string | null;
    imageUrl: string | null;
  };
}
