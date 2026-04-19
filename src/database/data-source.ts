import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource for TypeORM CLI (migration:generate, migration:run, migration:revert).
 *
 * IMPORTANT: This file runs WITHOUT NestJS bootstrap — the CLI invokes it directly.
 * Do NOT import ConfigService here. Read DATABASE_URL from process.env directly.
 *
 * Entity and migration paths point at dist/ (compiled JS) because this project
 * uses "module": "nodenext" in tsconfig, which causes TypeScript source file
 * loading to fail with "Cannot use import statement outside a module".
 * Always run `npm run build` before migration commands (scripts in package.json
 * already do this via the build-first pattern).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  // IMPORTANT: synchronize only in development — NEVER in production
  // CLI DataSource always has synchronize: false — schema is controlled by migrations
  synchronize: false,
  logging: false,
});
