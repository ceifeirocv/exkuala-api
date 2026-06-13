import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizerStatus } from '../organizer.entity';

/**
 * Query parameters for cursor-paginated admin organizer listings.
 * Pass cursor from a previous response's nextCursor to fetch the next page.
 *
 * Example: GET /admin/organizers?limit=20&status=pending&cursor=eyJpZCI6...
 */
export class OrganizerPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous nextCursor field' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: OrganizerStatus, description: 'Filter by status. Omit for all.' })
  @IsOptional()
  @IsEnum(OrganizerStatus)
  status?: OrganizerStatus;
}
