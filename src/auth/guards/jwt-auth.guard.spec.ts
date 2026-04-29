import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

function mockContext(handler = {}, cls = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({}) }),
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
  });
});
