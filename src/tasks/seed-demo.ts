import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';

import { seedDemoRestaurant } from './demo/seed';
import { DEMO_SLUG } from './demo/la-parrilla-de-tono';

/**
 * `pnpm db:seed`: carga el restaurante de demostración en la base del `.env`.
 * Solo para desarrollo: borra y vuelve a crear ese restaurante.
 */
async function main(): Promise<void> {
  const logger = new Logger('Seed');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('La semilla de demostración no se corre en producción.');
  }

  // Sin el ruido de arranque de Nest; después se vuelve a dejar pasar el
  // mensaje final.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  Logger.overrideLogger(['log', 'error', 'warn']);

  try {
    await seedDemoRestaurant(app);
    logger.log(`Restaurante de demostración listo: /public/${DEMO_SLUG}/menu`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  new Logger('Seed').error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
