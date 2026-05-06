import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizerEntity } from './organizer.entity';
import { OrganizerAuditLogEntity } from './organizer-audit-log.entity';
import { OrganizersService } from './organizers.service';
import { OrganizersController } from './organizers.controller';
import { AdminOrganizersController } from './admin-organizers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrganizerEntity, OrganizerAuditLogEntity])],
  providers: [OrganizersService],
  controllers: [OrganizersController, AdminOrganizersController],
  // Export OrganizersService so Phase 6 EventsModule can inject it for organizer ownership checks (D-09)
  exports: [OrganizersService],
})
export class OrganizersModule {}
