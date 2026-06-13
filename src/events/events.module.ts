import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { EventTranslationEntity } from './event-translation.entity';
import { EventAuditLogEntity } from './event-audit-log.entity';
import { EventsService } from './events.service';
import { AdminEventsService } from './admin-events.service';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';
import { AdminEventsController } from './admin-events.controller';
import { OrganizersModule } from '../organizers/organizers.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { EventsRsvpController } from './events-rsvp.controller';

@Module({
  // EventTranslationEntity added so EventsService can inject translationRepository (07-04)
  // EventAuditLogEntity added (Phase 9) so AdminEventsService can inject auditLogRepository
  // RsvpModule imported (Phase 8) so EventsService can inject RsvpService for RSVP-03 counts
  // and so EventsRsvpController can receive RsvpService (D-01, D-02).
  // EventEntity registered in TypeOrmModule.forFeature here AND in RsvpModule — TypeORM handles
  // multiple forFeature() calls for the same entity across modules safely (each gets its own token).
  imports: [
    TypeOrmModule.forFeature([EventEntity, EventTranslationEntity, EventAuditLogEntity]),
    OrganizersModule,
    RsvpModule,
  ],
  providers: [EventsService, AdminEventsService],
  controllers: [EventsController, PublicEventsController, EventsRsvpController, AdminEventsController],
})
export class EventsModule {}
