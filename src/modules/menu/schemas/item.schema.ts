import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { ITEM_TAGS, ItemTag } from '../domain/snapshot';

/** Pesos enteros: COP no usa decimales. */
export const integerPesos = {
  validator: Number.isInteger,
  message: 'El precio debe ser un número entero de pesos.',
};

@Schema({ collection: 'items', timestamps: true, strict: true })
export class Item {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  brandId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  categoryId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: String, default: null, maxlength: 500 })
  description!: string | null;

  /** Precio base, antes de adiciones. */
  @Prop({ required: true, min: 0, validate: integerPesos })
  price!: number;

  @Prop({ type: String, default: null })
  imageUrl!: string | null;

  /**
   * Clave de la foto en el almacenamiento, si la subió el restaurante. Sirve
   * para borrar la anterior al reemplazarla. `null` con `imageUrl` puesto: una
   * foto externa (la demostración), que no se borra.
   */
  @Prop({ type: String, default: null })
  imageKey!: string | null;

  /** Apagado en toda la marca. Una sucursal puede apagarlo solo para ella (`BranchItem`). */
  @Prop({ required: true, default: true })
  available!: boolean;

  @Prop({ required: true, default: 0 })
  position!: number;

  /** Referencias: un grupo ("Salsas") se reutiliza en muchos productos. El orden importa. */
  @Prop({ type: [Types.ObjectId], default: [] })
  modifierGroupIds!: Types.ObjectId[];

  /** "Más pedido", "Nuevo"… Ver `ITEM_TAGS`. */
  @Prop({ type: [String], enum: ITEM_TAGS, default: [] })
  tags!: ItemTag[];

  /** "Combina con…" elegido a mano. Vacío: se sugiere solo (ver `buildSnapshot`). */
  @Prop({ type: [Types.ObjectId], default: [] })
  pairsWith!: Types.ObjectId[];
}

export type ItemDocument = HydratedDocument<Item>;

export const ItemSchema = SchemaFactory.createForClass(Item);

ItemSchema.index({ tenantId: 1, brandId: 1, categoryId: 1, position: 1 });
