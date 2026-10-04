import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** El último número de pedido usado en cada sede. */
@Schema({ collection: 'orderCounters', strict: true })
export class OrderCounter {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  seq!: number;
}

export type OrderCounterDocument = HydratedDocument<OrderCounter>;

export const OrderCounterSchema = SchemaFactory.createForClass(OrderCounter);

OrderCounterSchema.index({ tenantId: 1, branchId: 1 }, { unique: true });
