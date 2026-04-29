import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

// Full implementation in Plan 02.
// Stub exists so AuthModule can export it without a missing-module compile error.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {}
