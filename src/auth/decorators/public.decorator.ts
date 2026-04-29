import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// @Public() — decorates a route handler or controller class to bypass JwtAuthGuard and RolesGuard
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
