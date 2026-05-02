import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { Auth0WebhookDto } from './dto/auth0-webhook.dto';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';

// POST /api/v1/webhooks/auth0
// Receives Auth0 Action calls on post-login and post-register events.
// @Public() bypasses the global JwtAuthGuard — this route has no JWT.
// @UseGuards(WebhookSecretGuard) enforces the shared-secret header check instead.
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @UseGuards(WebhookSecretGuard)
  @Post('auth0')
  @HttpCode(200)
  async handleAuth0Webhook(@Body() dto: Auth0WebhookDto): Promise<void> {
    await this.usersService.upsertFromAuth0(dto.sub);
  }
}
