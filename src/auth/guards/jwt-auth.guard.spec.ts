import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function mockContext(handler = {}, cls = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate()', () => {
    it('returns true immediately when route is marked @Public()', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      expect(guard.canActivate(mockContext())).toBe(true);
    });

    it('delegates to passport (rejects) when route is not @Public()', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      // super.canActivate() is async — calls passport which is not wired in unit tests.
      // We assert it DOES attempt passport (not an early return true), meaning the
      // returned Promise rejects rather than the guard short-circuiting to true.
      await expect(guard.canActivate(mockContext())).rejects.toBeDefined();
    });
  });
});
