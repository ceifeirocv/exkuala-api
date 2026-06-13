import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../types/auth';
import { AdminEventsService } from './admin-events.service';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { AdminEventModerationDto } from './dto/admin-event-moderation.dto';
import { PaginatedAdminEventsResponseDto } from './dto/paginated-admin-events-response.dto';

// Registered at /api/v1/admin/events via global prefix + URI versioning
@ApiTags('Admin - Events')
@ApiBearerAuth()
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly adminEventsService: AdminEventsService) {}

  // @Roles('admin') enforced by global RolesGuard (T-09-03-01)
  @Roles('admin')
  @Get()
  @ApiOperation({ summary: 'List all events across all organizers (admin only)' })
  @ApiResponse({
    status: 200,
    type: PaginatedAdminEventsResponseDto,
    description: 'Full EventEntity list, cursor-paginated. All statuses, all owners. ?includeDeleted=true includes soft-deleted rows.',
  })
  findAll(@Query() query: AdminEventQueryDto): Promise<PaginatedAdminEventsResponseDto> {
    return this.adminEventsService.findAllForAdmin(query);
  }

  @Roles('admin')
  @Patch(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suspend a DRAFT or PUBLISHED event (admin only)' })
  @ApiResponse({ status: 204, description: 'Event suspended.' })
  @ApiResponse({ status: 404, description: 'Event not found.' })
  @ApiResponse({ status: 409, description: 'Event already SUSPENDED or CANCELLED.' })
  suspend(
    @Param('id') id: string,
    @Body() dto: AdminEventModerationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // user.id is the local UserEntity.id — never user.sub (T-09-03-06; see src/types/auth.ts)
    return this.adminEventsService.adminSuspend(id, user.id, dto.note);
  }

  @Roles('admin')
  @Patch(':id/restore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a SUSPENDED event to its prior status (admin only)' })
  @ApiResponse({ status: 204, description: 'Event restored to prior status.' })
  @ApiResponse({ status: 404, description: 'Event not found.' })
  @ApiResponse({ status: 409, description: 'Event is not SUSPENDED.' })
  restore(
    @Param('id') id: string,
    @Body() dto: AdminEventModerationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.adminEventsService.adminRestore(id, user.id, dto.note);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete (remove) any event regardless of status or owner (admin only)' })
  @ApiResponse({ status: 204, description: 'Event removed.' })
  @ApiResponse({ status: 404, description: 'Event not found.' })
  remove(
    @Param('id') id: string,
    @Body() dto: AdminEventModerationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.adminEventsService.adminRemove(id, user.id, dto.note);
  }
}
