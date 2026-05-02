import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  // Upserts a user row keyed on auth0Id.
  // id is pre-generated here because @BeforeInsert does NOT fire on repository.upsert()
  // (TypeORM bypasses entity lifecycle hooks on the upsert code path — RESEARCH.md Pitfall 1).
  // On conflict (existing row): ON CONFLICT (auth0Id) DO UPDATE SET updatedAt = CURRENT_TIMESTAMP.
  // The existing row's id is preserved; the EXCLUDED.id value is not applied on conflict.
  async upsertFromAuth0(sub: string): Promise<void> {
    await this.userRepository.upsert(
      { id: createId(), auth0Id: sub },
      { conflictPaths: ['auth0Id'] },
    );
  }
}
