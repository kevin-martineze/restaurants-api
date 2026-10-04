import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const FULFILLMENT_TYPES = ['delivery', 'pickup', 'dine_in'] as const;

export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const BRANCH_STATUSES = ['open', 'paused', 'closed'] as const;

/**
 * `open` sigue el horario; `paused` es el botón de "no recibir más pedidos por
 * ahora" (cocina saturada); `closed` es cerrado indefinidamente.
 */
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

export const KITCHEN_LOADS = ['calm', 'busy', 'saturated'] as const;

/**
 * Qué tan cargada está la cocina. Hoy lo fija el restaurante; con pedidos
 * reales se calculará solo según la cola (modo hora pico).
 */
export type KitchenLoad = (typeof KITCHEN_LOADS)[number];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@Schema({ _id: false, strict: true })
export class ScheduleSlotDoc {
  /** 0 = domingo … 6 = sábado. */
  @Prop({ required: true, min: 0, max: 6 })
  day!: number;

  @Prop({ required: true, match: TIME_PATTERN })
  opens!: string;

  /** Si es menor o igual que `opens`, cierra al día siguiente. */
  @Prop({ required: true, match: TIME_PATTERN })
  closes!: string;
}

export const PAYMENT_METHODS = ['cash', 'card_on_delivery'] as const;

/**
 * Cómo se paga. Por ahora todo es al recibir: efectivo o datáfono que lleva
 * el domiciliario (o en la caja, si se recoge). Los pagos en línea (Wompi)
 * se agregan aquí cuando lleguen.
 */
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Punto GeoJSON: `[longitud, latitud]`, en ese orden. */
@Schema({ _id: false, strict: true })
export class GeoPointDoc {
  @Prop({ type: String, required: true, enum: ['Point'], default: 'Point' })
  type!: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates!: [number, number];
}

@Schema({ _id: false, strict: true })
export class DeliveryRingDoc {
  @Prop({ required: true, min: 0.1, max: 50 })
  maxKm!: number;

  @Prop({ required: true, min: 0, validate: Number.isInteger })
  fee!: number;

  @Prop({ required: true, min: 0, validate: Number.isInteger })
  minOrder!: number;
}

@Schema({ collection: 'branches', timestamps: true, strict: true })
export class Branch {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  /** Las marcas que se preparan en esta cocina. */
  @Prop({ type: [Types.ObjectId], required: true, default: [] })
  brandIds!: Types.ObjectId[];

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  /** Como lo lee el cliente: "El Prado, Barranquilla". */
  @Prop({ required: true, trim: true, maxlength: 200 })
  address!: string;

  @Prop({ required: true, default: 'America/Bogota' })
  timezone!: string;

  @Prop({ type: [ScheduleSlotDoc], default: [] })
  schedule!: ScheduleSlotDoc[];

  @Prop({ type: String, required: true, enum: BRANCH_STATUSES, default: 'open' })
  status!: BranchStatus;

  /** Preparación + entrega, en minutos. */
  @Prop({ required: true, min: 5, max: 240, default: 35 })
  etaMinutes!: number;

  @Prop({ type: [String], enum: FULFILLMENT_TYPES, default: ['delivery', 'pickup'] })
  fulfillment!: FulfillmentType[];

  @Prop({ type: String, required: true, enum: KITCHEN_LOADS, default: 'calm' })
  kitchenLoad!: KitchenLoad;

  /** Desde dónde salen los domicilios. Sin ubicación, la sede no hace domicilios. */
  @Prop({ type: GeoPointDoc, default: null })
  location!: GeoPointDoc | null;

  @Prop({ type: [DeliveryRingDoc], default: [] })
  deliveryRings!: DeliveryRingDoc[];

  @Prop({ type: [String], enum: PAYMENT_METHODS, default: ['cash', 'card_on_delivery'] })
  paymentMethods!: PaymentMethod[];
}

export type BranchDocument = HydratedDocument<Branch>;

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ tenantId: 1, brandIds: 1 });
BranchSchema.index({ location: '2dsphere' }, { sparse: true });
