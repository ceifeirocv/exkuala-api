import { Module } from '@nestjs/common';
import { RsvpModule } from '../rsvp/rsvp.module';
import { MeController } from './me.controller';

// MeModule — seeds /api/v1/me namespace for user-scoped endpoints (D-01).
// Imports RsvpModule to receive RsvpService for MeController injection.
// No TypeOrmModule.forFeature — MeModule owns no entities; RsvpService is consumed via import.
@Module({
  imports: [RsvpModule],
  controllers: [MeController],
})
export class MeModule {}
