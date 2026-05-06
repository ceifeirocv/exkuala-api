import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizersService } from './organizers.service';
import { OrganizerAuditLogEntity } from './organizer-audit-log.entity';
import { OrganizerEntity, OrganizerStatus } from './organizer.entity';
import { ApproveOrganizerDto } from './dto/approve-organizer.dto';
import { RejectOrganizerDto } from './dto/reject-organizer.dto';

// Registered at /api/v1/admin/organizers via global prefix + URI versioning
@ApiTags('Admin - Organizers')
@ApiBearerAuth()
@Controller('admin/organizers')
export class AdminOrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  // @Roles('admin') enforced by global RolesGuard (T-05-04-02)
  @Roles('admin')
  @Get()
  @ApiOperation({ summary: 'List organizers, optionally filtered by status (admin only)' })
  @ApiResponse({ status: 200, type: OrganizerEntity, isArray: true, description: 'Organizer list with status. Returns all statuses when status param is omitted.' })
  findAll(@Query() query: { status?: OrganizerStatus }): Promise<OrganizerEntity[]> {
    return this.organizersService.findByStatus(query.status);
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
  approve(@Param('id') id: string, @Body() dto: ApproveOrganizerDto): Promise<void> {
    return this.organizersService.approve(id, dto.note);
  }

  @Roles('admin')
  @Patch(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reject an organizer application (admin only)' })
  @ApiResponse({ status: 204, description: 'Application rejected.' })
  @ApiResponse({ status: 409, description: 'Invalid state transition.' })
  reject(@Param('id') id: string, @Body() dto: RejectOrganizerDto): Promise<void> {
    return this.organizersService.reject(id, dto.note);
  }
}
