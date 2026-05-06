import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { OrganizerEntity } from '../../organizers/organizer.entity';

// @CurrentOrganizer() — extracts the resolved OrganizerEntity from req.organizer.
// Only safe on routes protected by OrganizerGuard. Using on other routes returns undefined (programmer error).
// Mirrors @CurrentUser() pattern from current-user.decorator.ts (D-11).
export const CurrentOrganizer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): OrganizerEntity => {
    const request = ctx.switchToHttp().getRequest<{ organizer: OrganizerEntity }>();
    return request.organizer;
  },
);
