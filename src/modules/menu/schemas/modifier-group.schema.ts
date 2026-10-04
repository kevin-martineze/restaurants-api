import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { integerPesos } from './item.schema';

@Schema({ strict: true })
export class Modifier {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  /** Lo que suma al precio del producto. Puede ser 0. */
  @Prop({ required: true, min: 0, default: 0, validate: integerPesos })
  priceDelta!: number;

  @Prop({ required: true, default: true })
  available!: boolean;
}

const ModifierSchema = SchemaFactory.createForClass(Modifier);

/**
 * Un grupo de opciones con su mínimo y su máximo. Obligatorio es `min ≥ 1`.
 *
 * Las opciones van embebidas: son pocas y se leen siempre con el grupo.
 */
@Schema({ collection: 'modifierGroups', timestamps: true, strict: true })
export class ModifierGroup {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  brandId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, min: 0, max: 20, default: 0 })
  min!: number;

  @Prop({ required: true, min: 1, max: 20, default: 1 })
  max!: number;

  @Prop({ type: [ModifierSchema], default: [] })
  modifiers!: Modifier[];
}

export type ModifierGroupDocument = HydratedDocument<ModifierGroup>;

export const ModifierGroupSchema = SchemaFactory.createForClass(ModifierGroup);

ModifierGroupSchema.index({ tenantId: 1, brandId: 1 });

ModifierGroupSchema.pre('validate', function (next) {
  if (this.min > this.max) {
    next(new Error('El mínimo de un grupo no puede ser mayor que el máximo.'));

    return;
  }

  if (this.modifiers.length < this.min) {
    next(new Error('El grupo tiene menos opciones que su mínimo.'));

    return;
  }

  next();
});
