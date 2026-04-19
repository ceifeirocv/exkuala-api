import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // ConfigService injectable everywhere without re-importing (Pattern 4)
      validate,       // D-05: crashes process if DATABASE_URL or PORT missing/invalid
    }),
    // TypeOrmModule.forRootAsync wired in Plan 05
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
