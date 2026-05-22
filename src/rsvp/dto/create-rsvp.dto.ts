import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { RsvpState } from '../rsvp.entity';

/**
 * Request body for POST /events/:id/rsvp.
 * CANCELLED is intentionally excluded — it is an internal state set only by DELETE /events/:id/rsvp.
 *
 * Example: { state: 'GOING' }
 */
export class CreateRsvpDto {
  @ApiProperty({ enum: [RsvpState.INTERESTED, RsvpState.GOING] })
  @IsEnum([RsvpState.INTERESTED, RsvpState.GOING])
  @IsNotEmpty()
  state: RsvpState.INTERESTED | RsvpState.GOING;
}
