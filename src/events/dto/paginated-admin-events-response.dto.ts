import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventEntity } from '../event.entity';

/**
 * Cursor-paginated response for admin event listings.
 * Returns full EventEntity (not EventResponseDto) so admins see status,
 * statusBeforeSuspension, deletedAt, and organizerId (D-08, Phase 5 lesson).
 *
 * Example: { data: [...], nextCursor: 'base64url-cursor', hasMore: true }
 */
export class PaginatedAdminEventsResponseDto {
  // Full entity — admin must see all fields including status, statusBeforeSuspension, deletedAt
  @ApiProperty({ type: [EventEntity] })
  data: EventEntity[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opaque base64url cursor for next page. Null if no more results.',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
