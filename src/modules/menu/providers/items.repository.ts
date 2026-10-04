import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { Item } from '../schemas/item.schema';

@Injectable()
export class ItemsRepository extends TenantRepository<Item> {
  constructor(@InjectModel(Item.name) model: Model<Item>) {
    super(model);
  }
}
