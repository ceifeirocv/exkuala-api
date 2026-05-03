import { AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    // Augments Request.user to carry the full AuthenticatedUser shape.
    // No tsconfig changes needed — files under src/ are auto-included.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthenticatedUser {}
  }
}
