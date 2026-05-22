import { ApiProperty } from '@nestjs/swagger';
import { RsvpState } from '../rsvp.entity';

/**
 * Response body for POST /events/:id/rsvp (201 Created).
 *
 * Example: { id: 'rsvp-01', state: 'GOING', rsvpedAt: '2026-05-15T10:00:00Z' }
 */
export class RsvpResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: RsvpState })
  state: RsvpState;

  @ApiProperty()
  rsvpedAt: Date;
}
