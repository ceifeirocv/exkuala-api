import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RsvpEntity } from './rsvp.entity';
import { EventEntity } from '../events/event.entity';
import { RsvpService } from './rsvp.service';

@Module({
  imports: [
    // RsvpModule registers EventEntity here so RsvpService can inject
    // @InjectRepository(EventEntity) for the PUBLISHED guard in upsertRsvp() (T-08-04).
    // TypeORM handles multiple forFeature() registrations of the same entity across
    // modules safely — each module gets its own repository token.
    // EventsModule also registers EventEntity independently; no circular dependency
    // exists (RsvpModule → TypeOrmModule only).
    TypeOrmModule.forFeature([RsvpEntity, EventEntity]),
  ],
  providers: [RsvpService],
  // Export RsvpService so EventsModule (write routes + RSVP-03 counts) and
  // MeModule (history endpoint) can inject it without re-providing (D-02).
  exports: [RsvpService],
})
export class RsvpModule {}
