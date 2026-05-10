import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { PublicEventsQueryDto } from './dto/public-events-query.dto';
import { PublicEventDetailDto } from './dto/public-event-detail.dto';
import { PaginatedPublicEventsResponseDto } from './dto/paginated-public-events-response.dto';

// Registered at /api/v1/events — all routes bypass JWT guard via class-level @Public() (AUTH-04).
// Separate from EventsController which requires OrganizerGuard at class level (D-11, 07-CONTEXT.md).
@ApiTags('Events')
@Public()
@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events with cursor pagination and optional filters' })
  @ApiResponse({ status: 200, type: PaginatedPublicEventsResponseDto })
  findPublished(
    @Query() query: PublicEventsQueryDto,
  ): Promise<PaginatedPublicEventsResponseDto> {
    return this.eventsService.findPublished(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get published event detail by ID' })
  @ApiResponse({ status: 200, type: PublicEventDetailDto })
  @ApiResponse({ status: 404, description: 'Event not found or not published.' })
  findPublishedById(@Param('id') id: string): Promise<PublicEventDetailDto> {
    return this.eventsService.findPublishedById(id);
  }
}
