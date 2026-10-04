import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { configureHttp } from '@shared/config/configure-http';

export interface TestApp {
  app: NestFastifyApplication;
  stop: () => Promise<void>;
}

/**
 * La API completa, con el mismo prefijo y el mismo pipe de validación que
 * `main.ts`, contra un replica set en memoria (transacciones incluidas).
 */
export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  process.env.MONGODB_URI = mongo.getUri('restaurants-test');
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'secreto-de-pruebas-de-integracion-con-32+';
  // Las fotos de las pruebas van a un directorio temporal, nunca al de desarrollo.
  process.env.STORAGE_DRIVER = 'local';
  process.env.MEDIA_DIR = await mkdtemp(join(tmpdir(), 'restaurants-media-'));

  // `AppModule` valida el entorno al importarse: se importa después de fijar
  // la URI del Mongo en memoria, o tomaría la del `.env` local.
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  await configureHttp(app);

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  return {
    app,
    stop: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}
