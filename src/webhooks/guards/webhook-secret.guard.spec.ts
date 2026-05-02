import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSecretGuard } from './webhook-secret.guard';

function mockContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: headerValue !== undefined
          ? { 'x-webhook-secret': headerValue }
          : {},
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('WebhookSecretGuard', () => {
  let guard: WebhookSecretGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = { get: jest.fn().mockReturnValue('my-secret') } as unknown as ConfigService;
    guard = new WebhookSecretGuard(configService);
  });

  it('returns true when header matches secret', () => {
    expect(guard.canActivate(mockContext('my-secret'))).toBe(true);
  });

  it('returns false when header differs from secret', () => {
    expect(guard.canActivate(mockContext('wrong-secret'))).toBe(false);
  });

  it('returns false without throwing when lengths differ', () => {
    // Key: must not throw TypeError from timingSafeEqual when buffer lengths differ
    expect(() => guard.canActivate(mockContext('x'))).not.toThrow();
    expect(guard.canActivate(mockContext('x'))).toBe(false);
  });

  it('returns false when header is absent', () => {
    expect(guard.canActivate(mockContext(undefined))).toBe(false);
  });
});
