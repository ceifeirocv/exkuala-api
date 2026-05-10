import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Request body for PUT /organizer/events/:id/translations/:locale.
 * Upserts a translation for one locale. Title required; description optional.
 *
 * Example: { "title": "Noite de Jazz", "description": "Uma noite de clássicos." }
 */
export class UpsertEventTranslationDto {
  @ApiProperty({ example: 'Noite de Jazz', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Uma noite de clássicos.', maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
