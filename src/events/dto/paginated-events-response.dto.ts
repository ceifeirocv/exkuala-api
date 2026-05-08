import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventResponseDto } from './event-response.dto';

/**
 * Cursor-paginated response wrapper for event listings.
 * nextCursor is null when no more results exist.
 *
 * Example: { data: [...], nextCursor: 'base64url-cursor', hasMore: true }
 */
export class PaginatedEventsResponseDto {
  @ApiProperty({ type: [EventResponseDto] })
  data: EventResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Opaque base64url cursor for next page. Null if no more results.',
    example: 'eyJpZCI6ImV2X2FiYyJ9',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
