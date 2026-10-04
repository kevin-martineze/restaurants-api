import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * El menú publicado de una sucursal, en un solo documento.
 *
 * Modelo de lectura: la carta lo lee de una vez y la cotización valida contra
 * él. Lo escribe solo `MenuPublisher`, al editar el menú o marcar un agotado.
 * `categories` se guarda tal cual y se lee con `snapshotCategoriesSchema`.
 */
@Schema({ collection: 'menuSnapshots', timestamps: true, strict: true })
export class MenuSnapshot {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  brandId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  branchId!: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  version!: number;

  @Prop({ required: true })
  publishedAt!: Date;

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  categories!: unknown;
}

export type MenuSnapshotDocument = HydratedDocument<MenuSnapshot>;

export const MenuSnapshotSchema = SchemaFactory.createForClass(MenuSnapshot);

MenuSnapshotSchema.index({ tenantId: 1, brandId: 1, branchId: 1 }, { unique: true });
