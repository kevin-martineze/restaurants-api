import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lean } from '@shared/tenancy/tenant-repository';

import { User } from '../schemas/user.schema';

/** Los usuarios son de la plataforma: no usan la base con `tenantId`. */
@Injectable()
export class UsersRepository {
  constructor(@InjectModel(User.name) private readonly model: Model<User>) {}

  findByEmail(email: string): Promise<Lean<User> | null> {
    return this.model.findOne({ email: email.trim().toLowerCase() }).lean<Lean<User>>().exec();
  }

  findById(id: Types.ObjectId): Promise<Lean<User> | null> {
    return this.model.findById(id).lean<Lean<User>>().exec();
  }

  /** Crea o actualiza por correo. Para la semilla y, después, las invitaciones. */
  async upsert(data: Pick<User, 'email' | 'name' | 'passwordHash'>): Promise<Types.ObjectId> {
    const user = await this.model
      .findOneAndUpdate(
        { email: data.email.trim().toLowerCase() },
        { $set: { name: data.name, passwordHash: data.passwordHash, active: true } },
        { upsert: true, new: true, projection: { _id: 1 } },
      )
      .lean<{ _id: Types.ObjectId }>()
      .exec();

    return user._id;
  }

  async updatePasswordHash(id: Types.ObjectId, passwordHash: string): Promise<void> {
    await this.model.updateOne({ _id: id }, { passwordHash }).exec();
  }
}
