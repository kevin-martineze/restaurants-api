import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Error as MongooseError } from 'mongoose';

/** Forma única de todo error que sale de la API. El frontend narrowa contra esto. */
export interface ErrorBody {
  statusCode: number;
  /** En español, listo para mostrar. */
  message: string;
  /** Código estable para que el cliente decida sin parsear el mensaje. */
  error: string;
  /** Detalle de validación o de negocio, cuando lo hay. */
  details?: unknown;
  path: string;
  timestamp: string;
}

/** Error de índice único de Mongo (E11000). */
function isDuplicateKey(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) return false;

  return 'code' in exception && exception.code === 11000;
}

function readField(source: object, key: string): unknown {
  return key in source ? Reflect.get(source, key) : undefined;
}

/**
 * Traduce cualquier excepción a una respuesta con forma predecible.
 *
 * 1. **No filtrar nada.** Un error de Mongo sin envolver lleva el nombre de la
 *    colección, del índice y a veces el valor que chocó (un teléfono). Un 500
 *    dice solo que fue un 500; el detalle va al log.
 * 2. **Dar al frontend algo contra qué narrowar.** `error` es un código estable
 *    que no cambia si alguien reescribe el texto en español.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const body = this.toErrorBody(exception, request.url);

    // El 5xx se loguea entero porque es un fallo nuestro. El 4xx no: en la
    // carta pública es ruido constante.
    if (body.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    void reply.status(body.statusCode).send(body);
  }

  private toErrorBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const message = readField(response, 'message');
        const error = readField(response, 'error');

        // `ValidationPipe` responde con `message: string[]` en inglés: se
        // conserva como detalle y se da un mensaje en español.
        return {
          statusCode: status,
          message: Array.isArray(message)
            ? 'La información enviada no es válida.'
            : typeof message === 'string'
              ? message
              : exception.message,
          error: typeof error === 'string' ? error : 'http_exception',
          details: Array.isArray(message) ? message : readField(response, 'details'),
          path,
          timestamp,
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: 'http_exception',
        path,
        timestamp,
      };
    }

    if (isDuplicateKey(exception)) {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe un registro con ese valor.',
        error: 'duplicate',
        path,
        timestamp,
      };
    }

    // Un id con formato inválido en la URL: para afuera es "no existe".
    if (exception instanceof MongooseError.CastError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No encontramos lo que buscas.',
        error: 'not_found',
        path,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Algo falló de nuestro lado. Ya quedó registrado.',
      error: 'internal_error',
      path,
      timestamp,
    };
  }
}
