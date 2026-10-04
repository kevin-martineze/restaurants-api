import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { integerPesos } from './item.schema';

/**
 * Lo que una sucursal cambia de un producto de la marca. Solo existe si cambia
 * algo; si no, manda el valor del producto.
 */
@Schema({ collection: 'branchItems', timestamps: true, strict: true })
export class BranchItem {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  itemId!: Types.ObjectId;

  @Prop({ type: Number, default: null, min: 0, validate: integerPesos })
  price!: number | null;

  /** `false` es el agotado de la sucursal. */
  @Prop({ type: Boolean, default: null })
  available!: boolean | null;
}

export type BranchItemDocument = HydratedDocument<BranchItem>;

export const BranchItemSchema = SchemaFactory.createForClass(BranchItem);

BranchItemSchema.index({ tenantId: 1, branchId: 1, itemId: 1 }, { unique: true });
