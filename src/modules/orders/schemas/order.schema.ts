import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  GeoPointDoc,
  PAYMENT_METHODS,
  PaymentMethod,
} from '@modules/organization/schemas/branch.schema';

import {
  CHECKOUT_FULFILLMENTS,
  CheckoutFulfillment,
  ORDER_STATUSES,
  OrderStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
} from '../domain/order-status';

/*
 * El pedido guarda todo congelado: nombre y precio de cada producto y de
 * cada opción tal como estaban al pedir. Editar la carta después no cambia
 * un pedido ya hecho.
 */

@Schema({ _id: false, strict: true })
export class OrderModifier {
  @Prop({ required: true })
  modifierId!: string;

  @Prop({ required: true })
  groupName!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  priceDelta!: number;
}

@Schema({ _id: false, strict: true })
export class OrderItem {
  @Prop({ required: true })
  itemId!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: [OrderModifier], default: [] })
  modifiers!: OrderModifier[];

  @Prop({ type: String, default: '' })
  note!: string;

  @Prop({ required: true, min: 1 })
  qty!: number;

  @Prop({ required: true })
  unitPrice!: number;

  @Prop({ required: true })
  total!: number;
}

@Schema({ _id: false, strict: true })
export class OrderCustomer {
  @Prop({ type: Types.ObjectId, required: true })
  customerId!: Types.ObjectId;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  phone!: string;
}

@Schema({ _id: false, strict: true })
export class OrderAddress {
  @Prop({ required: true })
  text!: string;

  @Prop({ type: String, default: '' })
  neighborhood!: string;

  @Prop({ type: String, default: '' })
  references!: string;

  @Prop({ type: GeoPointDoc, required: true })
  location!: GeoPointDoc;

  @Prop({ required: true })
  distanceKm!: number;
}

@Schema({ _id: false, strict: true })
export class OrderTotals {
  @Prop({ required: true })
  subtotal!: number;

  @Prop({ required: true, default: 0 })
  deliveryFee!: number;

  @Prop({ required: true })
  total!: number;
}

@Schema({ _id: false, strict: true })
export class OrderPayment {
  @Prop({ type: String, required: true, enum: PAYMENT_METHODS })
  method!: PaymentMethod;

  @Prop({ type: String, required: true, enum: PAYMENT_STATUSES, default: 'pending' })
  status!: PaymentStatus;

  /** Con cuánto paga en efectivo, para llevar el cambio. `null`: paga exacto. */
  @Prop({ type: Number, default: null })
  cashTendered!: number | null;
}

/** Historial del pedido. Solo se agrega: nunca se edita un evento. */
@Schema({ _id: false, strict: true })
export class OrderEvent {
  @Prop({ type: String, required: true, enum: ORDER_STATUSES })
  status!: OrderStatus;

  @Prop({ type: Date, required: true })
  at!: Date;

  /** Quién lo causó: el cliente, alguien del equipo o el sistema. */
  @Prop({ type: String, required: true })
  actorRole!: string;

  @Prop({ type: String, default: null })
  reason!: string | null;
}

@Schema({ collection: 'orders', timestamps: true, strict: true })
export class Order {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  brandId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  /** Consecutivo por sede: el que se dice en voz alta ("el pedido 42"). */
  @Prop({ required: true })
  number!: number;

  /**
   * Secreto del enlace de seguimiento. El número solo es adivinable; con el
   * token, nadie ve el pedido de otro.
   */
  @Prop({ required: true })
  trackingToken!: string;

  @Prop({ type: String, required: true, default: 'web' })
  channel!: string;

  @Prop({ type: String, required: true, enum: CHECKOUT_FULFILLMENTS })
  fulfillment!: CheckoutFulfillment;

  @Prop({ type: OrderCustomer, required: true })
  customer!: OrderCustomer;

  @Prop({ type: OrderAddress, default: null })
  address!: OrderAddress | null;

  @Prop({ type: [OrderItem], required: true })
  items!: OrderItem[];

  @Prop({ type: OrderTotals, required: true })
  totals!: OrderTotals;

  @Prop({ type: OrderPayment, required: true })
  payment!: OrderPayment;

  /** El tiempo que se le prometió al cliente al pedir. */
  @Prop({ required: true })
  etaMinutes!: number;

  @Prop({ type: String, default: '' })
  notes!: string;

  @Prop({ type: String, required: true, enum: ORDER_STATUSES, default: 'received' })
  status!: OrderStatus;

  @Prop({ type: [OrderEvent], default: [] })
  events!: OrderEvent[];

  /** Dos envíos con la misma clave son el mismo pedido (doble toque, red lenta). */
  @Prop({ type: String, required: true })
  idempotencyKey!: string;
}

export type OrderDocument = HydratedDocument<Order>;

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ tenantId: 1, branchId: 1, number: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, branchId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, 'customer.customerId': 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
