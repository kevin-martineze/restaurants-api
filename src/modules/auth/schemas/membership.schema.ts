import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const ROLES = ['owner', 'manager', 'cashier', 'kitchen', 'rider'] as const;

/** Ver docs/roles.md del frontend. Los permisos los decide la API. */
export type Role = (typeof ROLES)[number];

/** Qué hace una persona en un restaurante. */
@Schema({ collection: 'memberships', timestamps: true, strict: true })
export class Membership {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ROLES })
  role!: Role;

  /** Sedes donde trabaja. Vacío: todas (dueño y gerente general). */
  @Prop({ type: [Types.ObjectId], default: [] })
  branchIds!: Types.ObjectId[];
}

export type MembershipDocument = HydratedDocument<Membership>;

export const MembershipSchema = SchemaFactory.createForClass(Membership);

MembershipSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ userId: 1 });
