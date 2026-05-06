import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { OrganizersService } from '../../organizers/organizers.service';
import { AuthenticatedUser } from '../../types/auth';
import { OrganizerEntity } from '../../organizers/organizer.entity';

// OrganizerGuard — resolves the approved OrganizerEntity for the current user and attaches it
// to req.organizer. Use @UseGuards(OrganizerGuard) on routes that require organizer identity.
// Throws 403 if the authenticated user has no approved organizer profile (D-11).
@Injectable()
export class OrganizerGuard implements CanActivate {
  constructor(private readonly organizersService: OrganizersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      organizer?: OrganizerEntity;
    }>();

    if (!request.user) {
      throw new ForbiddenException('Authentication required');
    }

    const organizer = await this.organizersService.findApprovedByUserId(request.user.id);
    if (!organizer) {
      throw new ForbiddenException('User is not an approved organizer');
    }

    request.organizer = organizer;
    return true;
  }
}
