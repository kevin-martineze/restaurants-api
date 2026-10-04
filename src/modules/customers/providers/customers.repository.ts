import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { Customer } from '../schemas/customer.schema';

/** Cuántas direcciones se recuerdan por cliente. */
export const MAX_SAVED_ADDRESSES = 5;

export interface CustomerOrderInput {
  phone: string;
  name: string;
  marketing: boolean;
  consentVersion: string;
  address: {
    text: string;
    neighborhood: string;
    references: string;
    location: { type: 'Point'; coordinates: [number, number] };
  } | null;
}

@Injectable()
export class CustomersRepository extends TenantRepository<Customer> {
  constructor(@InjectModel(Customer.name) model: Model<Customer>) {
    super(model);
  }

  /**
   * Crea o actualiza al cliente al hacer un pedido y devuelve su id: nombre y
   * consentimiento al día, un pedido más en sus estadísticas y, si es
   * domicilio, la dirección de primera en su lista.
   */
  async recordOrder(
    tenantId: Types.ObjectId,
    input: CustomerOrderInput,
    now: Date,
    session: ClientSession,
  ): Promise<Types.ObjectId> {
    const update = {
      $set: {
        name: input.name,
        'consent.serviceAt': now,
        'consent.marketing': input.marketing,
        'consent.marketingAt': input.marketing ? now : null,
        'consent.version': input.consentVersion,
        'stats.lastOrderAt': now,
      },
      $inc: { 'stats.orders': 1 },
      ...(input.address
        ? {
            $push: {
              addresses: {
                $each: [{ ...input.address, _id: new Types.ObjectId(), lastUsedAt: now }],
                $position: 0,
                $slice: MAX_SAVED_ADDRESSES,
              },
            },
          }
        : {}),
    };

    const customer = await this.model
      .findOneAndUpdate(this.scoped(tenantId, { phone: input.phone }), update, {
        upsert: true,
        new: true,
        session,
        projection: { _id: 1 },
      })
      .lean<{ _id: Types.ObjectId }>()
      .exec();

    return customer._id;
  }
}
