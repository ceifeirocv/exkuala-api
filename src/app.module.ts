import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { validate } from './config/env.validation';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EventEntity } from './events/event.entity';
import { UserEntity } from './users/user.entity';
import { CategoriesModule } from './categories/categories.module';
import { CategoryEntity } from './categories/category.entity';
import { CategoryTranslationEntity } from './categories/category-translation.entity';
import { OrganizersModule } from './organizers/organizers.module';
import { OrganizerEntity } from './organizers/organizer.entity';
import { OrganizerAuditLogEntity } from './organizers/organizer-audit-log.entity';
import { EventsModule } from './events/events.module';
import { EventTranslationEntity } from './events/event-translation.entity';
import { RsvpEntity } from './rsvp/rsvp.entity';
import { MeModule } from './me/me.module';

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
        entities: [UserEntity, EventEntity, CategoryEntity, CategoryTranslationEntity, OrganizerEntity, OrganizerAuditLogEntity, EventTranslationEntity, RsvpEntity],
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
    WebhooksModule,   // registers /api/v1/webhooks/auth0 endpoint
    CategoriesModule, // registers /api/v1/categories endpoints
    OrganizersModule, // registers /api/v1/organizers and /api/v1/admin/organizers endpoints
    EventsModule,     // registers /api/v1/organizer/events endpoints
    MeModule,         // registers /api/v1/me/rsvps endpoint
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
