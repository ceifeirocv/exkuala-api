import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Public profile — email intentionally excluded per D-03
export class OrganizerPublicResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  website: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialLinks: Record<string, string> | null;
}
