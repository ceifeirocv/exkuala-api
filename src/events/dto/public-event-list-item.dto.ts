import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public event list item. Does NOT include ticket price or external ticket URL (D-12).
 * translations map uses client-side locale resolution (D-01).
 *
 * Example: { id: 'cuid2-id', title: 'Jazz Night', translations: { pt: { title: 'Noite de Jazz', description: null } } }
 */
export class PublicEventListItemDto {
  @ApiProperty({ example: 'cuid2-event-id' })
  id: string;

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

  @ApiPropertyOptional({ nullable: true, example: 'Praia' })
  city: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://example.com/image.jpg' })
  imageUrl: string | null;

  @ApiProperty({ example: 'PUBLISHED' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  category: { id: string; slug: string; name: string } | null;

  @ApiProperty()
  organizer: { id: string; name: string };

  // All available translations — client picks preferred locale (D-01)
  @ApiProperty({ example: { pt: { title: 'Noite de Jazz', description: null } } })
  translations: Record<string, { title: string; description: string | null }>;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;
}
