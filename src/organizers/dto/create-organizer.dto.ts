import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateOrganizerDto {
  @ApiProperty({ example: 'Jazz Collective Lisboa', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Independent jazz promoter based in Lisbon.', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  description: string;

  // Business contact email — manually entered by the organizer, not pulled from Auth0 (D-01)
  @ApiProperty({ example: 'contact@jazzcollective.pt' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'https://jazzcollective.pt', maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  website?: string;

  // Open map — any key accepted, URL format on values not enforced in Phase 5 (D-02)
  @ApiPropertyOptional({ example: { instagram: 'https://instagram.com/jazzcollective' } })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
