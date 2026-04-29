import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  // Override handleRequest to make authentication optional.
  //
  // passport-jwt info parameter:
  //   absent token  → string 'No auth token' (not an Error instance)
  //   invalid token → JsonWebTokenError or TokenExpiredError (both instanceof Error)
  //
  // D-07: absent token → pass through (req.user = undefined)
  // D-08: invalid token → re-throw (→ 401 UnauthorizedException)
  handleRequest<T>(
    err: Error | null,
    user: T | false,
    info: Error | string | null,
  ): T | undefined {
    if (err) throw err;                          // internal passport error — always propagate
    if (!user && info instanceof Error) throw info; // D-08: present but invalid token
    return (user as T) || undefined;             // D-07: absent token or valid token
  }
}
