import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '../event.entity';

/**
 * DTO for updating an existing event.
 * All fields optional — only supplied fields are updated.
 * Status transitions: DRAFT→PUBLISHED, PUBLISHED→CANCELLED (enforced in service).
 *
 * Example: { status: 'PUBLISHED' }
 */
export class UpdateEventDto {
  @ApiPropertyOptional({ example: 'Jazz Night at Casa da Música', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: '2026-09-15T20:00:00.000Z',
    description: 'ISO 8601 datetime with timezone',
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ example: 'cuid2-category-id', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  categoryId?: string;

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

  @ApiPropertyOptional({
    enum: EventStatus,
    description:
      'Drive status transitions. DRAFT→PUBLISHED, PUBLISHED→CANCELLED only.',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
