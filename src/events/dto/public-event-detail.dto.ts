import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublicEventListItemDto } from './public-event-list-item.dto';

/**
 * Public event detail. Extends list item with ticket info and full organizer/category shapes (D-11, D-12).
 * Use for GET /events/:id response.
 */
export class PublicEventDetailDto extends PublicEventListItemDto {
  @ApiPropertyOptional({ nullable: true, example: 15.0 })
  ticketPrice: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://ticketline.sapo.pt/...' })
  externalTicketUrl: string | null;

  // Override organizer: full public profile (id, name, bio, contact) per D-11
  declare organizer: { id: string; name: string; bio: string | null; contact: string | null };

  // Override category: includes full translations map per D-11
  declare category: {
    id: string;
    slug: string;
    name: string;
    translations: Record<string, string>;
  } | null;

  // Phase 8 (RSVP-03): live COUNT of non-cancelled RSVPs per state (D-07, D-08)
  @ApiProperty({ example: 0 })
  interestedCount: number;

  @ApiProperty({ example: 0 })
  goingCount: number;
}
