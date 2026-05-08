import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for creating a new event.
 * Required: title, startAt, categoryId.
 * All other fields are optional — omit to leave unset.
 *
 * Example: { title: 'Jazz Night', startAt: '2026-09-15T20:00:00Z', categoryId: 'cat_abc123' }
 */
export class CreateEventDto {
  @ApiProperty({ example: 'Jazz Night at Casa da Música', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example: '2026-09-15T20:00:00.000Z',
    description: 'ISO 8601 datetime with timezone',
  })
  @IsDateString()
  startAt: string;

  @ApiProperty({ example: 'cuid2-category-id', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  categoryId: string;

  @ApiPropertyOptional({ example: 'A night of jazz classics.', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-09-15T23:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ example: 'Casa da Música', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueName?: string;

  @ApiPropertyOptional({ example: 'Av. da Boavista 604, Porto', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    example: 15.0,
    description: 'Ticket price in EUR. Omit for free events.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  ticketPrice?: number;

  @ApiPropertyOptional({
    example: 'https://ticketline.sapo.pt/...',
    maxLength: 2048,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  externalTicketUrl?: string;
}
