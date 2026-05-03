import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WebhookController } from './webhooks.controller';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';

// IMPORTANT: Do NOT register APP_GUARD providers here.
// JwtAuthGuard and RolesGuard are already APP_GUARD in AuthModule.
// Re-registering them would cause double-execution on all routes.
@Module({
  imports: [UsersModule],   // UsersModule exports UsersService (required for WebhookController injection)
  controllers: [WebhookController],
  providers: [WebhookSecretGuard],
})
export class WebhooksModule {}
