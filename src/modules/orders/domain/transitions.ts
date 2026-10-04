import type { CheckoutFulfillment, OrderStatus } from './order-status';

import type { Role } from '@modules/auth/schemas/membership.schema';

/**
 * El ciclo de vida del pedido. Ningún servicio cambia `status` sin pasar por
 * aquí (ver docs/estados-del-pedido.md).
 *
 * received → accepted → preparing → ready → dispatched → delivered   (domicilio)
 *                                         └→ picked_up               (recoger)
 * cualquiera antes de salir → cancelled (con motivo)
 * dispatched → failed_delivery → returned | dispatched (otro intento)
 */

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  received: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['dispatched', 'picked_up', 'cancelled'],
  dispatched: ['delivered', 'failed_delivery'],
  failed_delivery: ['dispatched', 'returned'],
  delivered: [],
  picked_up: [],
  cancelled: [],
  returned: [],
};

/** Quién puede llevar un pedido a cada estado. */
const ALLOWED_ROLES: Record<OrderStatus, Role[]> = {
  received: [],
  accepted: ['owner', 'manager', 'cashier'],
  preparing: ['owner', 'manager', 'cashier', 'kitchen'],
  ready: ['owner', 'manager', 'cashier', 'kitchen'],
  dispatched: ['owner', 'manager', 'cashier', 'rider'],
  delivered: ['owner', 'manager', 'cashier', 'rider'],
  failed_delivery: ['owner', 'manager', 'cashier', 'rider'],
  picked_up: ['owner', 'manager', 'cashier'],
  returned: ['owner', 'manager', 'cashier'],
  cancelled: ['owner', 'manager', 'cashier'],
};

export const CANCEL_REASONS = [
  'customer',
  'out_of_stock',
  'out_of_coverage',
  'restaurant',
  'other',
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

/** Estados en los que el pedido sigue vivo: los que se ven en el tablero. */
export const ACTIVE_STATUSES: OrderStatus[] = [
  'received',
  'accepted',
  'preparing',
  'ready',
  'dispatched',
  'failed_delivery',
];

/** Estados que cierran el pedido como entregado: el pago contra entrega ya se cobró. */
export const COLLECTED_STATUSES: OrderStatus[] = ['delivered', 'picked_up'];

export interface TransitionRequest {
  from: OrderStatus;
  to: OrderStatus;
  fulfillment: CheckoutFulfillment;
  role: Role;
  reason: CancelReason | null;
}

export type TransitionCheck = { ok: true } | { ok: false; message: string };

const LABEL: Record<OrderStatus, string> = {
  received: 'recibido',
  accepted: 'aceptado',
  preparing: 'en cocina',
  ready: 'listo',
  dispatched: 'en camino',
  delivered: 'entregado',
  picked_up: 'recogido',
  cancelled: 'cancelado',
  failed_delivery: 'no entregado',
  returned: 'devuelto',
};

/** ¿Se puede? Si no, por qué, en palabras para el equipo. */
export function checkTransition(request: TransitionRequest): TransitionCheck {
  const { from, to, fulfillment, role, reason } = request;

  if (!NEXT[from].includes(to)) {
    return { ok: false, message: `Un pedido ${LABEL[from]} no puede pasar a ${LABEL[to]}.` };
  }

  if (fulfillment === 'pickup' && (to === 'dispatched' || to === 'delivered')) {
    return { ok: false, message: 'Este pedido es para recoger: no sale a domicilio.' };
  }

  if (fulfillment === 'delivery' && to === 'picked_up') {
    return { ok: false, message: 'Este pedido es a domicilio: no se recoge en el local.' };
  }

  if (!ALLOWED_ROLES[to].includes(role)) {
    return { ok: false, message: 'Tu rol no permite este cambio.' };
  }

  if (to === 'cancelled' && reason === null) {
    return { ok: false, message: 'Di por qué se cancela el pedido.' };
  }

  return { ok: true };
}
