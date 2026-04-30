import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },  // #1 — sets req.user
    { provide: APP_GUARD, useClass: RolesGuard },     // #2 — reads req.user.roles
  ],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
