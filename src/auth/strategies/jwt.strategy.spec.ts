import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

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

const mockUsersService = { findOrCreate: jest.fn() } as unknown as UsersService;

describe('JwtStrategy', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('validate()', () => {
    const stubEntity = {
      id: 'stub',
      auth0Id: 'auth0|abc123',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    beforeEach(() => {
      (mockUsersService.findOrCreate as jest.Mock).mockResolvedValue(stubEntity);
    });

    it('extracts sub and roles from a JWT payload using the configured namespace', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      const payload = {
        sub: 'auth0|abc123',
        'https://exkuala.cv/roles': ['admin'],
      };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: 'stub', auth0Id: 'auth0|abc123', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'), roles: ['admin'] });
    });

    it('returns empty roles array when namespace claim is absent', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      const payload = { sub: 'auth0|abc123' };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: 'stub', auth0Id: 'auth0|abc123', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'), roles: [] });
    });

    it('returns empty roles when namespace claim is explicitly undefined', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      const payload = { sub: 'auth0|abc123', 'https://exkuala.cv/roles': undefined };
      const result = await strategy.validate(payload);
      expect(result).toEqual({ id: 'stub', auth0Id: 'auth0|abc123', createdAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01'), roles: [] });
    });
  });

  describe('async validate()', () => {
    it('returns AuthenticatedUser when findOrCreate resolves', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      (mockUsersService.findOrCreate as jest.Mock).mockResolvedValueOnce({
        id: 'user1',
        auth0Id: 'auth0|abc123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      const result = await strategy.validate({
        sub: 'auth0|abc123',
        'https://exkuala.cv/roles': ['admin'],
      });

      expect(result).toEqual({
        id: 'user1',
        auth0Id: 'auth0|abc123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        roles: ['admin'],
      });
      expect(mockUsersService.findOrCreate).toHaveBeenCalledWith('auth0|abc123');
    });

    it('throws UnauthorizedException when findOrCreate rejects', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      (mockUsersService.findOrCreate as jest.Mock).mockRejectedValueOnce(new Error('db error'));

      await expect(
        strategy.validate({ sub: 'auth0|abc123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
