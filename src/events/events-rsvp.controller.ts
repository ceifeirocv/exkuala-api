import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RsvpService } from '../rsvp/rsvp.service';
import { CreateRsvpDto } from '../rsvp/dto/create-rsvp.dto';
import { RsvpResponseDto } from '../rsvp/dto/rsvp-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/auth';

/**
 * RSVP write endpoints under /api/v1/events/:id/rsvp.
 * No @Public() — JwtAuthGuard applies globally (T-08-01).
 * Shares @Controller('events') prefix with PublicEventsController but requires auth.
 */
@ApiTags('Events')
@Controller('events')
export class EventsRsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  // POST /events/:id/rsvp — upsert semantics: second call updates state, preserves rsvpedAt (RSVP-01).
  // T-08-01: userId extracted from verified JWT via @CurrentUser(), never from request body.
  // T-08-04: RsvpService validates event existence and PUBLISHED status before upserting.
  @Post(':id/rsvp')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'RSVP to a published event (upsert — second call updates state)' })
  @ApiResponse({ status: 201, type: RsvpResponseDto })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 422, description: 'Event is not published' })
  upsertRsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
    @Body() dto: CreateRsvpDto,
  ): Promise<RsvpResponseDto> {
    return this.rsvpService.upsertRsvp(user.id, eventId, dto);
  }

  // DELETE /events/:id/rsvp — logical cancel: sets state = CANCELLED, row preserved (D-03, RSVP-02).
  // T-08-02: userId from JWT — a user can only cancel their own RSVP; returns 404 if not found.
  @Delete(':id/rsvp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel RSVP (sets state to CANCELLED, row preserved)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'RSVP not found' })
  cancelRsvp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventId: string,
  ): Promise<void> {
    return this.rsvpService.cancelRsvp(user.id, eventId);
  }
}
