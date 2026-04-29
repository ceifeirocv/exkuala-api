import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// @Roles('admin', 'organizer') — requires the authenticated user to have ALL listed roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
