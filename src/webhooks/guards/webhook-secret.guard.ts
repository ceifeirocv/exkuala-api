import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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

    // Reject immediately if either value is missing, not a string, or empty.
    if (
      typeof incomingSecret !== 'string' ||
      typeof expectedSecret !== 'string' ||
      incomingSecret.length === 0 ||
      expectedSecret.length === 0
    ) {
      return false;
    }

    // timingSafeEqual throws TypeError if byte lengths differ (RESEARCH.md Pitfall 2).
    // Return false before calling it — never throw 500 on a missing-secret request.
    if (incomingSecret.length !== expectedSecret.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(incomingSecret),
      Buffer.from(expectedSecret),
    );
  }
}
