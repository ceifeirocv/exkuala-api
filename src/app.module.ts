import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validate } from './config/env.validation';
import { EventEntity } from './events/event.entity';
import { UserEntity } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService injectable everywhere without re-importing (Pattern 4)
      validate,       // D-05: crashes process if DATABASE_URL or PORT missing/invalid
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get<string>('DATABASE_URL'),
        entities: [UserEntity, EventEntity],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        // IMPORTANT: synchronize only in development — NEVER in production (D-04)
        // synchronize: true auto-applies schema changes without running migration files.
        // In production this can silently drop columns. Always keep false in staging/prod.
        synchronize: cfg.get<string>('NODE_ENV') === 'development',
        migrationsRun: false, // Migrations run explicitly via `npm run migration:run` (D-08)
        logging: cfg.get<string>('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
