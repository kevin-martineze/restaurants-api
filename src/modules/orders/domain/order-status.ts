/**
 * Estados del pedido y del pago. Se guardan en inglés; el frontend los
 * traduce. Ver docs/estados-del-pedido.md.
 *
 * Las transiciones entre estados llegan en la fase 3 (tablero y cocina), en
 * una sola función. Por ahora un pedido solo nace en `received`.
 */
export const ORDER_STATUSES = [
  'received',
  'accepted',
  'preparing',
  'ready',
  'dispatched',
  'delivered',
  'picked_up',
  'cancelled',
  'failed_delivery',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Pago contra entrega: `pending` hasta que el domiciliario o la caja lo
 * cobran (`collected`).
 */
export const PAYMENT_STATUSES = ['pending', 'collected', 'refunded'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CHECKOUT_FULFILLMENTS = ['delivery', 'pickup'] as const;

/** Lo que se puede pedir desde la carta. En la mesa (`dine_in`) llega después. */
export type CheckoutFulfillment = (typeof CHECKOUT_FULFILLMENTS)[number];
