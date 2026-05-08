import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '../event.entity';

/**
 * Query parameters for paginated event listings.
 * Pass cursor from a previous response's nextCursor to fetch the next page.
 *
 * Example: GET /events?limit=20&status=PUBLISHED&cursor=eyJpZCI6ImV2X2FiYyJ9
 */
export class EventPaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor from previous response nextCursor field',
    example: 'eyJpZCI6ImV2X2FiYyJ9',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    default: 20,
    maximum: 100,
    description: 'Number of results per page. Max 100 (prevents pagination amplification).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    enum: EventStatus,
    description: 'Filter by event status. Omit to return all statuses.',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
