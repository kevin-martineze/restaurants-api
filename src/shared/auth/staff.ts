import type { Types } from 'mongoose';

import type { Role } from '@modules/auth/schemas/membership.schema';

/** Lo que dice el token: quién es. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

/** Lo que dice la membresía, consultada en esta petición: qué hace aquí. */
export interface StaffContext {
  tenantId: Types.ObjectId;
  userId: Types.ObjectId;
  role: Role;
  /** Sedes donde trabaja. Vacío: todas. */
  branchIds: Types.ObjectId[];
}

/** La petición después de pasar los guards del panel. */
export interface StaffRequest {
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string | undefined>;
  user?: AuthenticatedUser;
  staff?: StaffContext;
}

/** ¿Puede trabajar en esta sede? */
export function canWorkInBranch(staff: StaffContext, branchId: Types.ObjectId): boolean {
  return staff.branchIds.length === 0 || staff.branchIds.some((id) => id.equals(branchId));
}
