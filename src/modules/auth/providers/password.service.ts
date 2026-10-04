import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Hash y verificación de contraseñas con argon2id, con los parámetros mínimos
 * que sugiere OWASP (19 MiB, 2 pasadas, 1 hilo): decenas de milisegundos por
 * login en hardware modesto.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * false ante cualquier fallo, sin propagar: un hash corrupto no puede dar una
   * señal distinta a "contraseña incorrecta", que es lo que usa quien intenta
   * adivinar qué correos existen.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
