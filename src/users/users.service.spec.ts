import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

const mockRepository = {
  upsert: jest.fn().mockResolvedValue({ raw: [], generatedMaps: [] }),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('upsertFromAuth0()', () => {
    it('calls repository.upsert with sub as auth0Id', async () => {
      await service.upsertFromAuth0('auth0|abc123');
      expect(mockRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ auth0Id: 'auth0|abc123' }),
        { conflictPaths: ['auth0Id'] },
      );
    });

    it('generates an id for the entity', async () => {
      await service.upsertFromAuth0('auth0|abc123');
      const [entity] = mockRepository.upsert.mock.calls[0];
      expect(typeof entity.id).toBe('string');
      expect(entity.id.length).toBeGreaterThan(0);
    });

    it('does not throw when called twice with same sub', async () => {
      await expect(service.upsertFromAuth0('auth0|abc123')).resolves.not.toThrow();
      await expect(service.upsertFromAuth0('auth0|abc123')).resolves.not.toThrow();
    });
  });
});
