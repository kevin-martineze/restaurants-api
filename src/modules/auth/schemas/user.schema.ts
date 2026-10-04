import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/**
 * Una persona del equipo. Es de la plataforma, no de un restaurante: la misma
 * persona puede trabajar en dos (ver `Membership`).
 */
@Schema({ collection: 'users', timestamps: true, strict: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, maxlength: 160 })
  email!: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  /** argon2id. Nunca sale de la API. */
  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ required: true, default: true })
  active!: boolean;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
