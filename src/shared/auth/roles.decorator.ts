import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@modules/auth/schemas/membership.schema';

import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantRolesGuard } from './tenant-roles.guard';

export const ROLES_KEY = 'roles';

/**
 * Ruta del panel: exige sesión y membresía viva en el `:tenantId` del path.
 * Con roles, además, uno de ellos. Sin roles no significa "cualquiera":
 * significa "cualquier miembro de este restaurante".
 */
export function StaffRoute(...roles: Role[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, TenantRolesGuard),
    ApiBearerAuth(),
  );
}
