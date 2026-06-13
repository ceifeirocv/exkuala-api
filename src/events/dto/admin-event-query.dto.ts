import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EventStatus } from '../event.entity';

/**
 * Query parameters for admin event listings — all statuses, all organizers.
 * Pass cursor from previous response's nextCursor to fetch the next page.
 *
 * Example: GET /admin/events?limit=20&status=SUSPENDED&includeDeleted=true
 */
export class AdminEventQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous response nextCursor field' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Number of results per page. Max 100.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: EventStatus, description: 'Filter by status. Accepts SUSPENDED. Omit for all.' })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Filter events by organizerId.' })
  @IsOptional()
  @IsString()
  organizerId?: string;

  // Query strings arrive as text — Transform converts 'true' string to boolean (D-09).
  @ApiPropertyOptional({ description: 'Include soft-deleted events. Default false.' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;
}
