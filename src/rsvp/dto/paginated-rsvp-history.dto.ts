import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RsvpHistoryItemDto } from './rsvp-history-item.dto';

/**
 * Paginated envelope for GET /me/rsvps (D-10, D-11).
 * Cursor is opaque base64url string encoding (rsvpedAt, rsvpId).
 *
 * Example: { data: [...], nextCursor: 'eyJ...', hasMore: true }
 */
export class PaginatedRsvpHistoryDto {
  @ApiProperty({ type: [RsvpHistoryItemDto] })
  data: RsvpHistoryItemDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opaque base64url cursor for next page. Null if no more results.',
  })
  nextCursor: string | null;

  @ApiProperty()
  hasMore: boolean;
}
