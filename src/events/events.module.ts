import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { EventTranslationEntity } from './event-translation.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';
import { OrganizersModule } from '../organizers/organizers.module';

@Module({
  // EventTranslationEntity added so EventsService can inject translationRepository (07-04)
  imports: [TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]), OrganizersModule],
  providers: [EventsService],
  controllers: [EventsController, PublicEventsController],
})
export class EventsModule {}
