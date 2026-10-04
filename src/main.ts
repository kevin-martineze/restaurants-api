import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCompress from '@fastify/compress';
import fastifyHelmet from '@fastify/helmet';
import { Env } from '@shared/config/env';
import { buildValidationPipe } from '@shared/config/validation-pipe';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  /**
   * En desarrollo el log va formateado; en producción, JSON en una línea, que
   * es lo que sabe indexar el agregador de logs.
   */
  const adapter = new FastifyAdapter({
    logger: isProduction
      ? { level: 'info' }
      : {
          level: 'debug',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
    // Las fotos no entran como base64: irán como multipart. 1 MB alcanza para
    // el pedido más grande en JSON.
    bodyLimit: 1024 * 1024,
    // Detrás del proxy la IP real llega en `X-Forwarded-For`. Sin esto, el
    // límite por IP vería a todo internet como un solo visitante.
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  // Los plugins se registran sobre la app, no sobre el adapter: así los tipos
  // de Fastify encajan (ver la misma nota en ecommerce-api).
  await app.register(fastifyHelmet, {
    // Swagger UI usa scripts en línea; la documentación solo existe fuera de
    // producción, así que la excepción vive y muere con ella.
    contentSecurityPolicy: isProduction ? undefined : false,
  });
  await app.register(fastifyCompress);

  const config = app.get(ConfigService<Env, true>);

  const apiPrefix = config.get('API_PREFIX', { infer: true });
  const port = config.get('PORT', { infer: true });
  const corsOrigins = config.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(buildValidationPipe());

  // El frontend habla con esta API servidor contra servidor; la lista vacía
  // significa que ningún navegador cruza, y está bien.
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Cierra la conexión con Mongo al recibir SIGTERM en vez de dejarla colgando.
  app.enableShutdownHooks();

  if (!isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Restaurantes — API')
        .setDescription(
          'API multi-inquilino. Superficies previstas:\n\n' +
            '- `/public/:slug/*` — carta, cotización y pedidos del cliente. Sin autenticación.\n' +
            '- `/tenants/:tenantId/*` — panel, cocina y domiciliarios. Requiere sesión y membresía.\n' +
            '- `/platform/*` — administración de la plataforma.',
        )
        .setVersion('0.1')
        .addBearerAuth()
        .build(),
    );

    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');

  logger.log(`API escuchando en http://localhost:${port}/${apiPrefix}`);

  if (!isProduction) {
    logger.log(`Documentación en http://localhost:${port}/${apiPrefix}/docs`);
  }
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error('La API no pudo arrancar', error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
