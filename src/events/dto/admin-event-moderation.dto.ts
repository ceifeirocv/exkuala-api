import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Shared body DTO for admin suspend, restore, and remove endpoints.
 * Note is persisted in event_audit_log for non-repudiation (D-14, SEC-01).
 *
 * Example: { "note": "Violates community guidelines section 3.2" }
 */
export class AdminEventModerationDto {
  @ApiPropertyOptional({ description: 'Optional admin note/reason. Max 2000 chars (SEC-01).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
