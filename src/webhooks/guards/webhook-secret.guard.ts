import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class WebhookSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const incomingSecret = req.headers['x-webhook-secret'];
    const expectedSecret = this.config.get<string>('WEBHOOK_SECRET');

    // Reject non-string or empty values before any comparison.
    if (
      typeof incomingSecret !== 'string' ||
      typeof expectedSecret !== 'string' ||
      incomingSecret.length === 0 ||
      expectedSecret.length === 0
    ) {
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }

    // Pad both buffers to maxLen so timingSafeEqual always receives equal-length inputs.
    // An early-return on length mismatch leaks secret length via timing oracle (CR-01).
    const maxLen = Math.max(incomingSecret.length, expectedSecret.length);
    const a = Buffer.alloc(maxLen);
    const b = Buffer.alloc(maxLen);
    Buffer.from(incomingSecret).copy(a);
    Buffer.from(expectedSecret).copy(b);

    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid or missing webhook secret');
    }

    return true;
  }
}
