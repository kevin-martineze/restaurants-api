import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lean } from '@shared/tenancy/tenant-repository';

import { Tenant } from '../schemas/tenant.schema';

/** Los tenants son la raíz: no pertenecen a nadie, así que no usan la base con `tenantId`. */
@Injectable()
export class TenantsRepository {
  constructor(@InjectModel(Tenant.name) private readonly model: Model<Tenant>) {}

  async create(data: Pick<Tenant, 'name'>): Promise<Types.ObjectId> {
    const created = await this.model.create(data);

    return created._id;
  }

  findById(id: Types.ObjectId): Promise<Lean<Tenant> | null> {
    return this.model.findById(id).lean<Lean<Tenant>>().exec();
  }

  async deleteById(id: Types.ObjectId): Promise<void> {
    await this.model.deleteOne({ _id: id }).exec();
  }
}
