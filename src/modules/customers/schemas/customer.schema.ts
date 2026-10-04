import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { GeoPointDoc } from '@modules/organization/schemas/branch.schema';

/**
 * Autorización de tratamiento de datos (Ley 1581 de 2012). El restaurante es
 * el responsable; nosotros, los encargados. Servicio y marketing van
 * separados: usar el teléfono para avisar del pedido no autoriza promociones.
 */
@Schema({ _id: false, strict: true })
export class CustomerConsent {
  /** Aceptó el tratamiento para gestionar sus pedidos. */
  @Prop({ type: Date, required: true })
  serviceAt!: Date;

  @Prop({ required: true, default: false })
  marketing!: boolean;

  @Prop({ type: Date, default: null })
  marketingAt!: Date | null;

  /** Versión del texto que aceptó, para saber qué le mostramos. */
  @Prop({ required: true })
  version!: string;
}

@Schema({ strict: true })
export class CustomerAddress {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  text!: string;

  @Prop({ type: String, default: '', trim: true, maxlength: 80 })
  neighborhood!: string;

  @Prop({ type: String, default: '', trim: true, maxlength: 200 })
  references!: string;

  @Prop({ type: GeoPointDoc, required: true })
  location!: GeoPointDoc;

  @Prop({ type: Date, required: true })
  lastUsedAt!: Date;
}

const CustomerAddressSchema = SchemaFactory.createForClass(CustomerAddress);

@Schema({ _id: false, strict: true })
export class CustomerStats {
  @Prop({ required: true, default: 0 })
  orders!: number;

  @Prop({ type: Date, default: null })
  lastOrderAt!: Date | null;
}

/**
 * Cliente de un restaurante. El mismo teléfono en dos restaurantes son dos
 * clientes: la relación es de cada restaurante, no de la plataforma.
 */
@Schema({ collection: 'customers', timestamps: true, strict: true })
export class Customer {
  @Prop({ type: Types.ObjectId, required: true })
  tenantId!: Types.ObjectId;

  /** E.164: `+573001234567`. */
  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ type: CustomerConsent, required: true })
  consent!: CustomerConsent;

  /** Las últimas direcciones usadas, la más reciente primero. Acotadas. */
  @Prop({ type: [CustomerAddressSchema], default: [] })
  addresses!: CustomerAddress[];

  @Prop({ type: CustomerStats, required: true, default: () => ({}) })
  stats!: CustomerStats;
}

export type CustomerDocument = HydratedDocument<Customer>;

export const CustomerSchema = SchemaFactory.createForClass(Customer);

CustomerSchema.index({ tenantId: 1, phone: 1 }, { unique: true });
