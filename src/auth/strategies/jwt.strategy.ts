import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    // Use `config` parameter directly in super() — this.config is unbound here (Pitfall 1)
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: config.get<string>('AUTH0_JWKS_URI')!,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.get<string>('AUTH0_AUDIENCE'),
      issuer: config.get<string>('AUTH0_ISSUER'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): { sub: string; roles: string[] } {
    // Namespace is read at request time via this.config — safe after super() (Pitfall 1 does not apply here)
    const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
    return {
      sub: payload.sub,
      roles: (payload[namespace] as string[]) ?? [],
    };
  }
}
