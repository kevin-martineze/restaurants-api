import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH } from '../slug';

@Schema({ _id: false, strict: true })
export class BrandTheme {
  /** Color principal de la carta. Hex u `oklch(...)`; el frontend lo valida otra vez. */
  @Prop({ required: true, default: 'oklch(0.2 0 0)', maxlength: 64 })
  primary!: string;

  @Prop({ required: true, default: 'oklch(1 0 0)', maxlength: 64 })
  primaryForeground!: string;
}

/**
 * La marca que ve el cliente, con su carta y su enlace.
 *
 * Un restaurante normal tiene una; una dark kitchen, varias sobre la misma
 * cocina.
 */
@Schema({ collection: 'brands', timestamps: true, strict: true })
export class Brand {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  /** Único en toda la plataforma: es la URL pública de la carta. */
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    minlength: SLUG_MIN_LENGTH,
    maxlength: SLUG_MAX_LENGTH,
  })
  slug!: string;

  @Prop({ type: String, default: null, maxlength: 160 })
  tagline!: string | null;

  @Prop({ type: String, default: null })
  logoUrl!: string | null;

  /** Foto de portada de la carta. */
  @Prop({ type: String, default: null })
  coverUrl!: string | null;

  @Prop({ type: BrandTheme, required: true, default: () => ({}) })
  theme!: BrandTheme;

  /** La sucursal que atiende la carta cuando no se elige otra. */
  @Prop({ type: Types.ObjectId, default: null })
  defaultBranchId!: Types.ObjectId | null;
}

export type BrandDocument = HydratedDocument<Brand>;

export const BrandSchema = SchemaFactory.createForClass(Brand);
