import 'reflect-metadata';
import { validate, EnvironmentVariables } from './env.validation';

describe('validate (env)', () => {
  it('returns a validated EnvironmentVariables instance when all required vars are present', () => {
    const result = validate({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '3000',
      AUTH0_JWKS_URI: 'https://example.auth0.com/.well-known/jwks.json',
      AUTH0_AUDIENCE: 'https://api.example.com',
      AUTH0_ISSUER: 'https://example.auth0.com/',
      AUTH0_NAMESPACE: 'https://example.com',
      WEBHOOK_SECRET: 'a-webhook-secret-that-is-at-least-32-chars',
    });
    expect(result).toBeInstanceOf(EnvironmentVariables);
    expect(result.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(result.PORT).toBe(3000); // coerced from string to number via enableImplicitConversion
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({ PORT: '3000' })).toThrow();
  });

  it('throws when PORT is missing', () => {
    expect(() =>
      validate({ DATABASE_URL: 'postgresql://localhost/test' }),
    ).toThrow();
  });

  it('throws when PORT is above the 65535 max', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgresql://localhost/test',
        PORT: '99999',
      }),
    ).toThrow();
  });

  it('throws when PORT is not a number', () => {
    expect(() =>
      validate({
        DATABASE_URL: 'postgresql://localhost/test',
        PORT: 'abc',
      }),
    ).toThrow();
  });

  it('ignores unknown properties on the input object', () => {
    const result = validate({
      DATABASE_URL: 'postgresql://localhost/test',
      PORT: '3000',
      AUTH0_JWKS_URI: 'https://example.auth0.com/.well-known/jwks.json',
      AUTH0_AUDIENCE: 'https://api.example.com',
      AUTH0_ISSUER: 'https://example.auth0.com/',
      AUTH0_NAMESPACE: 'https://example.com',
      WEBHOOK_SECRET: 'a-webhook-secret-that-is-at-least-32-chars',
      SOMETHING_ELSE: 'ignored',
    });
    expect(result.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(result.PORT).toBe(3000);
  });
});
