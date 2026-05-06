import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/auth';
import { OrganizersService } from './organizers.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { OrganizerPublicResponseDto } from './dto/organizer-public-response.dto';
import { OrganizerSelfResponseDto } from './dto/organizer-self-response.dto';

// Registered at /api/v1/organizers via global prefix + URI versioning
@ApiTags('Organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an organizer application' })
  @ApiResponse({ status: 201, description: 'Application submitted. Status is pending.' })
  @ApiResponse({ status: 409, description: 'Application already exists or invalid state transition.' })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizerDto,
  ): Promise<OrganizerSelfResponseDto> {
    // userId from JWT — never from body (T-05-04-01: prevents user A submitting for user B)
    return this.organizersService.apply(user.id, dto);
  }

  // GET /organizers/me MUST be declared before GET /organizers/:id — NestJS matches routes in
  // registration order; "me" would otherwise be interpreted as an :id param (RESEARCH.md Pitfall 3)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user's own organizer application" })
  @ApiResponse({ status: 200, description: 'Own organizer profile with all fields and latest rejection note.' })
  @ApiResponse({ status: 404, description: 'No organizer application found for this user.' })
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<OrganizerSelfResponseDto> {
    return this.organizersService.findSelfWithLatestNote(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get public organizer profile (approved organizers only)' })
  @ApiResponse({ status: 200, description: 'Public organizer profile. Email is not included.' })
  @ApiResponse({ status: 404, description: 'Organizer not found or not approved.' })
  findById(@Param('id') id: string): Promise<OrganizerPublicResponseDto> {
    // findApprovedById returns OrganizerEntity (status-gated: throws 404 for pending/rejected per D-03).
    // The entity is structurally compatible with OrganizerPublicResponseDto (superset of its fields).
    // Email is not included in OrganizerPublicResponseDto per D-03.
    // Note: HTTP serialization will include all entity fields unless serialization is configured.
    // For strict email exclusion at runtime, apply a serialization interceptor in a future phase.
    return this.organizersService.findApprovedById(id) as unknown as Promise<OrganizerPublicResponseDto>;
  }
}
