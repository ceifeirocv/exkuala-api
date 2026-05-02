import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  // exports is REQUIRED — WebhooksModule imports UsersModule to access UsersService (RESEARCH.md Pitfall 5)
  exports: [UsersService],
})
export class UsersModule {}
