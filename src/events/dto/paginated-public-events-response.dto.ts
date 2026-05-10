import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicEventListItemDto } from './public-event-list-item.dto';

/**
 * Cursor-paginated response for public event listing.
 * nextCursor is null when no more results exist (D-13).
 *
 * Example: { data: [...], nextCursor: 'base64url-cursor', hasMore: true }
 */
export class PaginatedPublicEventsResponseDto {
  @ApiProperty({ type: [PublicEventListItemDto] })
  data: PublicEventListItemDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opaque base64url cursor for next page. Null if no more results.',
    example: 'eyJpZCI6ImV2X2FiYyJ9',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
