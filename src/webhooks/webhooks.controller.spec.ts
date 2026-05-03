import { UsersService } from '../users/users.service';
import { WebhookController } from './webhooks.controller';

const mockUsersService = {
  upsertFromAuth0: jest.fn().mockResolvedValue(undefined),
};

describe('WebhookController', () => {
  let controller: WebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhookController(mockUsersService as unknown as UsersService);
  });

  it('calls usersService.upsertFromAuth0 with dto.sub', async () => {
    await controller.handleAuth0Webhook({ sub: 'auth0|abc123', event: 'post-register' });
    expect(mockUsersService.upsertFromAuth0).toHaveBeenCalledWith('auth0|abc123');
  });
});
