import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix — applied to all controllers before the version segment.
  // Produces URLs shaped like /api/v1/... (Pattern 5).
  app.setGlobalPrefix('api');

  // URI versioning — the 'v' prefix is added automatically by NestJS.
  // All controllers with no explicit @Version() use defaultVersion '1'.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global ValidationPipe (D-08):
  //   whitelist: true  -> strip unknown DTO properties silently
  //   transform: true  -> convert plain request bodies into DTO class instances
  //   unknown props are silently stripped, not rejected (D-08)
  //   No custom ExceptionFilter -> default NestJS error shape (D-09)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger — non-production only (D-07).
  // addBearerAuth() (no args) uses default scheme name 'bearer', pre-arming
  // Phase 2 protected routes for Try-It-Out in /api/docs without further changes (D-06).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Cultural Agenda API')
      .setDescription('Cultural events discovery platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    // Path has NO leading slash (Pitfall 6) -> UI served at /api/docs
    SwaggerModule.setup('api/docs', app, document);
  }

  // enableShutdownHooks ensures NestJS lifecycle hooks (OnModuleDestroy) fire on SIGTERM.
  // TypeORM connection pool will be properly closed on graceful shutdown.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}
bootstrap();
