import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { buildValidationPipe } from '@shared/config/validation-pipe';

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

  // `AppModule` valida el entorno al importarse: se importa después de fijar
  // la URI del Mongo en memoria, o tomaría la del `.env` local.
  const { AppModule } = await import('../../src/app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(buildValidationPipe());

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
