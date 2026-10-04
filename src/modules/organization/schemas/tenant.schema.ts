import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const TENANT_STATUSES = ['active', 'suspended'] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

/** La empresa que paga: un restaurante, una cadena o una dark kitchen. */
@Schema({ collection: 'tenants', timestamps: true, strict: true })
export class Tenant {
  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: String, required: true, enum: TENANT_STATUSES, default: 'active' })
  status!: TenantStatus;
}

export type TenantDocument = HydratedDocument<Tenant>;

export const TenantSchema = SchemaFactory.createForClass(Tenant);
