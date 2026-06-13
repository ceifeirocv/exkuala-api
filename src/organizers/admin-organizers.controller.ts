import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../types/auth';
import { OrganizersService } from './organizers.service';
import { OrganizerAuditLogEntity } from './organizer-audit-log.entity';
import { ApproveOrganizerDto } from './dto/approve-organizer.dto';
import { RejectOrganizerDto } from './dto/reject-organizer.dto';
import { OrganizerPaginationQueryDto } from './dto/organizer-pagination-query.dto';
import { PaginatedOrganizersResponseDto } from './dto/paginated-organizers-response.dto';

// Registered at /api/v1/admin/organizers via global prefix + URI versioning
@ApiTags('Admin - Organizers')
@ApiBearerAuth()
@Controller('admin/organizers')
export class AdminOrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  // @Roles('admin') enforced by global RolesGuard (T-05-04-02)
  @Roles('admin')
  @Get()
  @ApiOperation({ summary: 'List organizers with cursor pagination, optionally filtered by status (admin only)' })
  @ApiResponse({ status: 200, type: PaginatedOrganizersResponseDto, description: 'Cursor-paginated organizer list. Returns all statuses when status param is omitted.' })
  findAll(@Query() query: OrganizerPaginationQueryDto): Promise<PaginatedOrganizersResponseDto> {
    return this.organizersService.findByStatusPaginated(query);
  }

  @Roles('admin')
  @Get(':id/history')
  @ApiOperation({ summary: 'Get full audit log for an organizer (admin only)' })
  @ApiResponse({ status: 200, type: OrganizerAuditLogEntity, isArray: true, description: 'Audit log entries, newest first.' })
  findHistory(@Param('id') id: string): Promise<OrganizerAuditLogEntity[]> {
    return this.organizersService.findAuditHistory(id);
  }

  @Roles('admin')
  @Patch(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Approve an organizer application (admin only)' })
  @ApiResponse({ status: 204, description: 'Application approved.' })
  @ApiResponse({ status: 409, description: 'Invalid state transition.' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveOrganizerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // user.id is the local UserEntity.id — never user.sub (T-09-01-03; see src/types/auth.ts)
    return this.organizersService.approve(id, user.id, dto.note);
  }

  @Roles('admin')
  @Patch(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject an organizer application (admin only)' })
  @ApiResponse({ status: 204, description: 'Application rejected.' })
  @ApiResponse({ status: 409, description: 'Invalid state transition.' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectOrganizerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    // user.id is the local UserEntity.id — never user.sub (T-09-01-03; see src/types/auth.ts)
    return this.organizersService.reject(id, user.id, dto.note);
  }
}
