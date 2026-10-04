import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { OrderCounter } from '../schemas/order-counter.schema';

@Injectable()
export class OrderCountersRepository {
  constructor(@InjectModel(OrderCounter.name) private readonly model: Model<OrderCounter>) {}

  /**
   * El siguiente número de pedido de la sede. Va dentro de la transacción
   * del pedido: si el pedido no se crea, el número tampoco se gasta.
   */
  async next(
    tenantId: Types.ObjectId,
    branchId: Types.ObjectId,
    session: ClientSession,
  ): Promise<number> {
    const counter = await this.model
      .findOneAndUpdate(
        { tenantId, branchId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session, projection: { seq: 1 } },
      )
      .lean<{ seq: number }>()
      .exec();

    return counter.seq;
  }

  /** Solo para reiniciar datos de demostración: borra los contadores del tenant. */
  async deleteForTenant(tenantId: Types.ObjectId): Promise<void> {
    await this.model.deleteMany({ tenantId }).exec();
  }
}
