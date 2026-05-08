import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizersModule } from '../organizers/organizers.module';

@Module({
  // OrganizersModule imported so OrganizerGuard can inject OrganizersService (D-22)
  imports: [TypeOrmModule.forFeature([EventEntity]), OrganizersModule],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
