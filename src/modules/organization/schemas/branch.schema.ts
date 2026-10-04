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
}

export type BranchDocument = HydratedDocument<Branch>;

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ tenantId: 1, brandIds: 1 });
