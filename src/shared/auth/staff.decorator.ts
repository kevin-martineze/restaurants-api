import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

import { AuthenticatedUser, StaffContext, StaffRequest } from './staff';

/** Qué hace la persona en este restaurante. Solo en rutas con `@StaffRoute`. */
export const Staff = createParamDecorator((_data: unknown, ctx: ExecutionContext): StaffContext => {
  const staff = ctx.switchToHttp().getRequest<StaffRequest>().staff;

  if (!staff) throw new ForbiddenException({ error: 'forbidden', message: 'Vuelve a entrar.' });

  return staff;
});

/** Quién es. Solo en rutas con `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = ctx.switchToHttp().getRequest<StaffRequest>().user;

    if (!user) throw new ForbiddenException({ error: 'forbidden', message: 'Vuelve a entrar.' });

    return user;
  },
);
