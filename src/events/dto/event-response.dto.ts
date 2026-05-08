import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../event.entity';

/**
 * Response shape for a single event.
 * deletedAt is intentionally excluded — soft-deleted events never appear in responses.
 *
 * Example: { id: 'ev_abc', title: 'Jazz Night', status: 'PUBLISHED', ... }
 */
export class EventResponseDto {
  @ApiProperty({ example: 'cuid2-event-id' })
  id: string;

  @ApiProperty({ example: 'cuid2-organizer-id' })
  organizerId: string;

  @ApiPropertyOptional({ nullable: true, example: 'cuid2-category-id' })
  categoryId: string | null;

  @ApiProperty({ example: 'Jazz Night at Casa da Música' })
  title: string;

  @ApiPropertyOptional({ nullable: true, example: 'A night of jazz classics.' })
  description: string | null;

  @ApiProperty({ example: '2026-09-15T20:00:00.000Z' })
  startAt: Date;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-15T23:00:00.000Z' })
  endAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: 'Casa da Música' })
  venueName: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Av. da Boavista 604, Porto' })
  address: string | null;

  @ApiPropertyOptional({ nullable: true, example: 15.0 })
  ticketPrice: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://ticketline.sapo.pt/...' })
  externalTicketUrl: string | null;

  @ApiProperty({ enum: EventStatus, example: EventStatus.DRAFT })
  status: EventStatus;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  updatedAt: Date;
}
