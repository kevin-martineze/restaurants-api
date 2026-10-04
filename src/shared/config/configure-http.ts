import { resolve } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { FastifyInstance } from 'fastify';
import { MULTIPART_OPTIONS } from '@shared/media/upload';

import { Env } from './env';
import { buildValidationPipe } from './validation-pipe';

/**
 * Lo que la API registra sobre Fastify y Nest, en un solo lugar para que la
 * app y las pruebas de integración corran con EXACTAMENTE lo mismo.
 */
export async function configureHttp(app: NestFastifyApplication): Promise<void> {
  const config = app.get(ConfigService<Env, true>);

  // Las fotos entran como multipart, con su propio techo de tamaño.
  await app.register(fastifyMultipart, MULTIPART_OPTIONS);

  // Con el driver local la propia API sirve las fotos. Con S3 las sirve el
  // bucket (o un CDN) y esta ruta no existe.
  if (config.get('STORAGE_DRIVER', { infer: true }) === 'local') {
    const mediaRoot = resolve(config.get('MEDIA_DIR', { infer: true }));

    await app.register(async (media: FastifyInstance) => {
      // Helmet pone `Cross-Origin-Resource-Policy: same-origin` en todo, y con
      // eso el navegador no pinta una foto de la API dentro de la carta, que
      // vive en otro origen. Solo las fotos se abren.
      media.addHook('onSend', async (_request, reply, payload) => {
        reply.header('cross-origin-resource-policy', 'cross-origin');

        return payload;
      });

      await media.register(fastifyStatic, {
        root: mediaRoot,
        prefix: '/media/',
        // Las claves llevan marca de tiempo y nunca se reutilizan.
        maxAge: '365d',
        immutable: true,
        decorateReply: false,
      });
    });
  }

  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }));
  app.useGlobalPipes(buildValidationPipe());
}
