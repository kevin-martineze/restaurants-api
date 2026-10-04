import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Env, validateEnv } from '@shared/config/env';
import { AllExceptionsFilter } from '@shared/filters/all-exceptions.filter';
import { HealthModule } from '@modules/health/health.module';
import { MenuModule } from '@modules/menu/menu.module';
import { OrganizationModule } from '@modules/organization/organization.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Sin esto, un typo en una variable se descubre en la primera petición
      // que la usa, no al arrancar.
      validate: validateEnv,
      // Las pruebas fijan su propio entorno; el `.env` de la máquina no debe
      // colarse en ellas.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),

    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // Los índices se declaran en los esquemas y se crean al arrancar. En
        // producción, con colecciones grandes, esto se apaga y se crean en un
        // script de despliegue.
        autoIndex: config.get('NODE_ENV', { infer: true }) !== 'production',
      }),
    }),

    /**
     * Límite por IP. El techo global es holgado: los endpoints públicos que
     * importan (crear pedido, cotizar) declaran su propio `@Throttle`.
     */
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),

    HealthModule,
    OrganizationModule,
    MenuModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
