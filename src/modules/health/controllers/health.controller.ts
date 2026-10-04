import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Connection } from 'mongoose';

/**
 * Sondas de salud.
 *
 * - `/health` (liveness): ¿el proceso está vivo? No toca la base. Si la
 *   consultara, una caída momentánea de Mongo haría que el orquestador
 *   reiniciara todos los contenedores sanos a la vez.
 * - `/health/ready` (readiness): ¿puede atender tráfico? Sí toca la base. Si
 *   falla, el balanceador deja de mandarle peticiones pero no lo reinicia.
 */
@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: 'Liveness: el proceso responde. No consulta la base.' })
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: hay conexión con MongoDB.' })
  async ready(): Promise<{ status: string; database: string }> {
    const db = this.connection.db;

    try {
      if (!db) throw new Error('Sin conexión');

      await db.admin().ping();
    } catch {
      throw new ServiceUnavailableException('Sin conexión con la base de datos.');
    }

    return { status: 'ok', database: 'up' };
  }
}
