import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { BranchItem } from '../schemas/branch-item.schema';

@Injectable()
export class BranchItemsRepository extends TenantRepository<BranchItem> {
  constructor(@InjectModel(BranchItem.name) model: Model<BranchItem>) {
    super(model);
  }
}
