import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizerStatus } from '../organizer.entity';

// Self-view response — all fields including email + latest rejection note (D-04)
export class OrganizerSelfResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  website: string | null;

  @ApiPropertyOptional({ nullable: true })
  socialLinks: Record<string, string> | null;

  @ApiProperty({ enum: OrganizerStatus })
  status: OrganizerStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  // Latest rejection note from audit log when status is rejected (D-15). Null when approved or no rejections.
  @ApiPropertyOptional({ nullable: true })
  latestRejectionNote: string | null;
}
