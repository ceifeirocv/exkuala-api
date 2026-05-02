import { IsIn, IsString } from 'class-validator';

// DTO for Auth0 Action webhook body.
// Auth0 Action sends: { sub: "auth0|<user_id>", event: "post-login" | "post-register" }
// Global ValidationPipe (whitelist: true, transform: true) strips any extra fields silently.
export class Auth0WebhookDto {
  // sub is the Auth0 user_id (event.user.user_id from Auth0 Action)
  @IsString()
  sub: string;

  // event distinguishes first-time registration from subsequent logins
  @IsIn(['post-login', 'post-register'])
  event: 'post-login' | 'post-register';
}
