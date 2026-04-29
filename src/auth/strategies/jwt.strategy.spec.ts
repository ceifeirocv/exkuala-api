import { ConfigService } from '@nestjs/config';

// Mock jwks-rsa before importing JwtStrategy — passportJwtSecret is only called
// in the constructor's super() call; tests only exercise validate(), not JWKS fetching.
jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => jest.fn()),
}));

// Mock PassportStrategy base — super() wires Passport internals that require a live strategy
// registry. Not needed for unit-testing the validate() method.
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: unknown) => {
    return class {
      constructor() {}
    };
  },
}));

import { JwtStrategy } from './jwt.strategy';

// Minimal stub to keep tests runnable until full implementation is added in Task 2.
// Real tests added in Plan 02 after OptionalJwtAuthGuard is complete.
const mockConfig = (key: string): string => {
  const values: Record<string, string> = {
    AUTH0_JWKS_URI: 'https://test.auth0.com/.well-known/jwks.json',
    AUTH0_AUDIENCE: 'https://api.exkuala.cv',
    AUTH0_ISSUER: 'https://test.auth0.com/',
    AUTH0_NAMESPACE: 'https://exkuala.cv/roles',
  };
  return values[key] ?? '';
};

describe('JwtStrategy', () => {
  describe('validate()', () => {
    it('extracts sub and roles from a JWT payload using the configured namespace', () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config);
      const payload = {
        sub: 'auth0|abc123',
        'https://exkuala.cv/roles': ['admin'],
      };
      const result = strategy.validate(payload);
      expect(result).toEqual({ sub: 'auth0|abc123', roles: ['admin'] });
    });

    it('returns empty roles array when namespace claim is absent', () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config);
      const payload = { sub: 'auth0|abc123' };
      const result = strategy.validate(payload);
      expect(result).toEqual({ sub: 'auth0|abc123', roles: [] });
    });

    it('returns empty roles when namespace claim is explicitly undefined', () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config);
      const payload = { sub: 'auth0|abc123', 'https://exkuala.cv/roles': undefined };
      const result = strategy.validate(payload);
      expect(result).toEqual({ sub: 'auth0|abc123', roles: [] });
    });
  });
});
