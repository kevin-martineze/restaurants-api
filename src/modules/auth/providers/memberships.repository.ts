import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lean, TenantRepository } from '@shared/tenancy/tenant-repository';

import { Membership } from '../schemas/membership.schema';

@Injectable()
export class MembershipsRepository extends TenantRepository<Membership> {
  constructor(@InjectModel(Membership.name) model: Model<Membership>) {
    super(model);
  }

  /**
   * Los restaurantes de una persona. Es la única consulta sin `tenantId`:
   * al entrar todavía no se sabe en cuál va a trabajar.
   */
  forUser(userId: Types.ObjectId): Promise<Lean<Membership>[]> {
    return this.model.find({ userId }).lean<Lean<Membership>[]>().exec();
  }

  forUserInTenant(
    tenantId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<Lean<Membership> | null> {
    return this.findOne(tenantId, { userId });
  }
}
