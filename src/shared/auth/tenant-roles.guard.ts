import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isValidObjectId, Types } from 'mongoose';
import { MembershipsRepository } from '@modules/auth/providers/memberships.repository';
import { UsersRepository } from '@modules/auth/providers/users.repository';
import { Role } from '@modules/auth/schemas/membership.schema';

import { ROLES_KEY } from './roles.decorator';
import { StaffRequest } from './staff';

function forbidden(message: string): ForbiddenException {
  return new ForbiddenException({ error: 'forbidden', message });
}

/**
 * Autoriza el acceso a un restaurante (`:tenantId`) y, si la ruta lo pide, por
 * rol.
 *
 * La membresía se consulta EN CADA PETICIÓN, no se lee del token: quitarle el
 * acceso a alguien surte efecto en la siguiente petición, no cuando vuelva a
 * entrar. Corre después de `JwtAuthGuard` y deja en `request.staff` qué hace
 * la persona en este restaurante.
 */
@Injectable()
export class TenantRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly memberships: MembershipsRepository,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffRequest>();
    const tenantParam = request.params.tenantId;

    if (!request.user) throw forbidden('Vuelve a entrar.');

    if (!tenantParam || !isValidObjectId(tenantParam)) {
      throw forbidden('No tienes acceso a este restaurante.');
    }

    const tenantId = new Types.ObjectId(tenantParam);
    const userId = new Types.ObjectId(request.user.id);
    const [membership, user] = await Promise.all([
      this.memberships.forUserInTenant(tenantId, userId),
      this.users.findById(userId),
    ]);

    if (!membership || !user?.active) throw forbidden('No tienes acceso a este restaurante.');

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required && required.length > 0 && !required.includes(membership.role)) {
      throw forbidden('Tu rol no permite esta acción.');
    }

    request.staff = {
      tenantId,
      userId,
      role: membership.role,
      branchIds: membership.branchIds,
    };

    return true;
  }
}
