import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../types/auth';

// @CurrentUser() — extracts the typed user from req.user.
// Only safe on routes protected by JwtAuthGuard. Using on @Public() routes returns undefined (programmer error).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
