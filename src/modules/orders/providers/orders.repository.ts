import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lean, TenantRepository } from '@shared/tenancy/tenant-repository';

import { Order } from '../schemas/order.schema';

@Injectable()
export class OrdersRepository extends TenantRepository<Order> {
  constructor(@InjectModel(Order.name) model: Model<Order>) {
    super(model);
  }

  findByIdempotencyKey(tenantId: Types.ObjectId, key: string): Promise<Lean<Order> | null> {
    return this.findOne(tenantId, { idempotencyKey: key });
  }
}
