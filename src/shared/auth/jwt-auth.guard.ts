import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { StaffRequest } from './staff';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

function isPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false;

  return (
    typeof Reflect.get(value, 'sub') === 'string' && typeof Reflect.get(value, 'email') === 'string'
  );
}

function unauthenticated(): UnauthorizedException {
  return new UnauthorizedException({
    error: 'unauthenticated',
    message: 'Tu sesión venció. Vuelve a entrar.',
  });
}

/** Exige un token válido y deja en `request.user` quién es. No mira restaurantes. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const header = request.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';

    if (!token) throw unauthenticated();

    let payload: unknown;

    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw unauthenticated();
    }

    if (!isPayload(payload)) throw unauthenticated();

    request.user = { id: payload.sub, email: payload.email };

    return true;
  }
}
