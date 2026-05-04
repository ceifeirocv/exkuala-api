import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
  // slug intentionally omitted — write-once after creation (D-02).
  // Global ValidationPipe(whitelist: true) strips any slug field if included in the request body.
  // Do NOT extend PartialType(CreateCategoryDto) as that would inherit the slug field.
}
