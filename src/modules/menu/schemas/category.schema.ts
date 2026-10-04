import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { CATEGORY_ROLES, CategoryRole } from '../domain/snapshot';

@Schema({ collection: 'categories', timestamps: true, strict: true })
export class Category {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  brandId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, default: 0 })
  position!: number;

  @Prop({ required: true, default: true })
  active!: boolean;

  /** Principal, acompañante, bebida o postre: decide qué se sugiere con qué. */
  @Prop({ type: String, required: true, enum: CATEGORY_ROLES, default: 'main' })
  role!: CategoryRole;
}

export type CategoryDocument = HydratedDocument<Category>;

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ tenantId: 1, brandId: 1, position: 1 });
