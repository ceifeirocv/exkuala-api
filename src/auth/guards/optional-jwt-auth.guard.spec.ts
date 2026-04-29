import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { Reflector } from '@nestjs/core';

// Build a minimal instance: OptionalJwtAuthGuard extends JwtAuthGuard which needs Reflector.
// We only test handleRequest here — the canActivate @Public() path is covered in jwt-auth.guard.spec.ts.
function makeGuard(): OptionalJwtAuthGuard {
  const reflector = new Reflector();
  return new OptionalJwtAuthGuard(reflector);
}

class FakeJwtError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonWebTokenError';
  }
}

describe('OptionalJwtAuthGuard', () => {
  describe('handleRequest()', () => {
    it('returns undefined when no token is present (info is a string)', () => {
      const guard = makeGuard();
      // Absent token: user=false, info='No auth token' (string, not Error)
      const result = guard.handleRequest(null, false, 'No auth token');
      expect(result).toBeUndefined();
    });

    it('throws when token is present but invalid (info instanceof Error)', () => {
      const guard = makeGuard();
      const tokenError = new FakeJwtError('invalid signature');
      expect(() => guard.handleRequest(null, false, tokenError)).toThrow('invalid signature');
    });

    it('throws when a passport internal error occurs (err is set)', () => {
      const guard = makeGuard();
      const internalError = new Error('passport processing error');
      expect(() => guard.handleRequest(internalError, false, null)).toThrow('passport processing error');
    });

    it('returns the user object when token is valid', () => {
      const guard = makeGuard();
      const user = { sub: 'auth0|abc', roles: ['user'] };
      const result = guard.handleRequest(null, user, null);
      expect(result).toEqual(user);
    });
  });
});
