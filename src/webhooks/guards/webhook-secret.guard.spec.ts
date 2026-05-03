import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
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

  it('throws UnauthorizedException when header differs from secret', () => {
    expect(() => guard.canActivate(mockContext('wrong-secret'))).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException (not TypeError) when lengths differ', () => {
    // Buffer padding (not early-return) prevents TypeError from timingSafeEqual.
    // The guard must throw UnauthorizedException, never a raw TypeError.
    expect(() => guard.canActivate(mockContext('x'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(mockContext('x'))).not.toThrow(TypeError);
  });

  it('throws UnauthorizedException when header is absent', () => {
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(UnauthorizedException);
  });
});
