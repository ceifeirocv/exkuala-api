import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Query parameters for public event listing.
 * All filters optional; combine freely. cursor is opaque base64url from previous response.
 *
 * Example: GET /events?category=music&city=Praia&q=jazz&limit=20&cursor=eyJ...
 */
export class PublicEventsQueryDto {
  @ApiPropertyOptional({ example: 'music', description: 'Filter by category slug (DISC-01)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z', description: 'Events starting on or after this date ISO 8601 (DISC-02)' })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59Z', description: 'Events starting on or before this date ISO 8601 (DISC-02)' })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({ example: 'Praia', description: 'Case-insensitive prefix match on city (DISC-03, D-09)' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'jazz night', description: 'Full-text search using plainto_tsquery simple config (DISC-04, D-07)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Opaque cursor from previous response nextCursor field (EVT-06)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Results per page. Max 100 (D-13).' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
