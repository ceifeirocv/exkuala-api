import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizerEntity } from '../organizer.entity';

/**
 * Cursor-paginated response wrapper for admin organizer listings.
 * Admin list returns full OrganizerEntity (not public DTO) — preserves status + email fields (D-08 equivalent).
 *
 * Example: { data: [...], nextCursor: 'base64url-cursor', hasMore: true }
 */
export class PaginatedOrganizersResponseDto {
  @ApiProperty({ type: [OrganizerEntity] })
  data: OrganizerEntity[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opaque base64url cursor for next page. Null if no more results.',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
