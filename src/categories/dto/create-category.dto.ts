import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // Optional explicit slug override (D-01). If absent, service derives from name via slugify.
  // Pattern enforces D-04: lowercase, URL-safe, alphanumeric + hyphens only.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens only' })
  slug?: string;
}
