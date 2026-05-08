import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrganizerGuard } from '../auth/guards/organizer.guard';
import { CurrentOrganizer } from '../auth/decorators/current-organizer.decorator';
import { OrganizerEntity } from '../organizers/organizer.entity';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventPaginationQueryDto } from './dto/event-pagination-query.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { PaginatedEventsResponseDto } from './dto/paginated-events-response.dto';

// Registered at /api/v1/organizer/events via global prefix + URI versioning (D-22)
@ApiTags('Organizer Events')
@ApiBearerAuth()
@UseGuards(OrganizerGuard)
@Controller('organizer/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a draft event' })
  @ApiResponse({ status: 201, type: EventResponseDto })
  create(
    @CurrentOrganizer() organizer: OrganizerEntity,
    @Body() dto: CreateEventDto,
  ): Promise<EventResponseDto> {
    // organizerId from guard-resolved entity — never from body (T-06-05-02)
    return this.eventsService.create(organizer.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List own events with cursor pagination' })
  @ApiResponse({ status: 200, type: PaginatedEventsResponseDto })
  findOwned(
    @CurrentOrganizer() organizer: OrganizerEntity,
    @Query() query: EventPaginationQueryDto,
  ): Promise<PaginatedEventsResponseDto> {
    return this.eventsService.findOwned(organizer.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get own event by ID' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  @ApiResponse({ status: 404, description: 'Event not found or not owned by this organizer.' })
  findOwnedById(
    @CurrentOrganizer() organizer: OrganizerEntity,
    @Param('id') id: string,
  ): Promise<EventResponseDto> {
    return this.eventsService.findOwnedById(organizer.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event fields or drive status transition' })
  @ApiResponse({ status: 200, type: EventResponseDto })
  @ApiResponse({ status: 409, description: 'Invalid status transition or event is cancelled.' })
  @ApiResponse({ status: 422, description: 'Publish gate failed — missing required fields or date in past.' })
  update(
    @CurrentOrganizer() organizer: OrganizerEntity,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ): Promise<EventResponseDto> {
    return this.eventsService.update(organizer.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a draft event (sets deletedAt)' })
  @ApiResponse({ status: 204, description: 'Event soft-deleted.' })
  @ApiResponse({ status: 409, description: 'Only draft events can be deleted.' })
  softDeleteDraft(
    @CurrentOrganizer() organizer: OrganizerEntity,
    @Param('id') id: string,
  ): Promise<void> {
    return this.eventsService.softDeleteDraft(organizer.id, id);
  }
}
