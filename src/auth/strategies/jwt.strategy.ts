import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../../types/auth';

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
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

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Namespace is read at request time via this.config — safe after super() (Pitfall 1 does not apply here)
    const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
    const roles = (payload[namespace] as string[]) ?? [];
    try {
      const user = await this.usersService.findOrCreate(payload.sub);
      return { ...user, roles };
    } catch {
      // Any DB error becomes 401 — belt-and-suspenders; webhook path should have created the user.
      throw new UnauthorizedException();
    }
  }
}
