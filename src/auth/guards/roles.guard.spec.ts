import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function mockContext(user?: { roles: string[] }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  describe('canActivate()', () => {
    it('returns true when route is marked @Public()', () => {
      jest.spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(true)  // IS_PUBLIC_KEY check
        .mockReturnValueOnce([]); // ROLES_KEY (not reached)
      expect(guard.canActivate(mockContext())).toBe(true);
    });

    it('returns true when no @Roles() are required', () => {
      jest.spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]);   // ROLES_KEY — empty
      expect(guard.canActivate(mockContext({ roles: ['user'] }))).toBe(true);
    });

    it('returns true when user has required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(false)      // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // ROLES_KEY
      expect(guard.canActivate(mockContext({ roles: ['admin'] }))).toBe(true);
    });

    it('returns false when user lacks required role', () => {
      jest.spyOn(reflector, 'getAllAndOverride')
        .mockReturnValueOnce(false)      // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // ROLES_KEY
      expect(guard.canActivate(mockContext({ roles: ['user'] }))).toBe(false);
    });
  });
});
