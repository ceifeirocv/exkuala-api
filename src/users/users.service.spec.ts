import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

const mockRepository = {
  upsert: jest.fn().mockResolvedValue({ raw: [], generatedMaps: [] }),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
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

  describe('findOrCreate()', () => {
    const stubEntity: UserEntity = {
      id: 'abc',
      auth0Id: 'auth0|abc123',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as UserEntity;

    it('happy path: returns existing entity without calling upsertFromAuth0', async () => {
      mockRepository.findOne.mockResolvedValueOnce(stubEntity);
      const upsertSpy = jest.spyOn(service as unknown as { upsertFromAuth0: (sub: string) => Promise<void> }, 'upsertFromAuth0');

      const result = await service.findOrCreate('auth0|abc123');

      expect(result).toEqual(stubEntity);
      expect(upsertSpy).not.toHaveBeenCalled();
    });

    it('fallback path: calls upsertFromAuth0 then re-fetches when user absent', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      mockRepository.findOneOrFail.mockResolvedValueOnce(stubEntity);
      const upsertSpy = jest.spyOn(service as unknown as { upsertFromAuth0: (sub: string) => Promise<void> }, 'upsertFromAuth0').mockResolvedValueOnce(undefined);

      const result = await service.findOrCreate('auth0|abc123');

      expect(upsertSpy).toHaveBeenCalledWith('auth0|abc123');
      expect(result).toEqual(stubEntity);
    });

    it('error propagation: propagates upsertFromAuth0 rejection to caller', async () => {
      const dbError = new Error('db connection failed');
      mockRepository.findOne.mockResolvedValueOnce(null);
      jest.spyOn(service as unknown as { upsertFromAuth0: (sub: string) => Promise<void> }, 'upsertFromAuth0').mockRejectedValueOnce(dbError);

      await expect(service.findOrCreate('auth0|abc123')).rejects.toThrow(dbError);
    });
  });
});
