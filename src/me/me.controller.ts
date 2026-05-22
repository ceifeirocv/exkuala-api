import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RsvpService } from '../rsvp/rsvp.service';
import { RsvpHistoryQueryDto } from '../rsvp/dto/rsvp-history-query.dto';
import { PaginatedRsvpHistoryDto } from '../rsvp/dto/paginated-rsvp-history.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/auth';

/**
 * GET /api/v1/me/rsvps — authenticated RSVP history endpoint.
 * No @Public() — JwtAuthGuard applies globally (T-08-03).
 * Seeds the /me namespace for future profile/notification endpoints (D-01).
 */
@ApiTags('Me')
@Controller('me')
export class MeController {
  constructor(private readonly rsvpService: RsvpService) {}

  // GET /me/rsvps — cursor-paginated RSVP history, excluding cancelled (D-05, RSVP-04).
  // T-08-03: listUserRsvps() scopes WHERE to userId from JWT — user A cannot read user B's history.
  @Get('rsvps')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user's RSVP history (excludes cancelled)" })
  @ApiResponse({ status: 200, type: PaginatedRsvpHistoryDto })
  listRsvps(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RsvpHistoryQueryDto,
  ): Promise<PaginatedRsvpHistoryDto> {
    return this.rsvpService.listUserRsvps(user.id, query);
  }
}
