import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { ModifierGroup } from '../schemas/modifier-group.schema';

@Injectable()
export class ModifierGroupsRepository extends TenantRepository<ModifierGroup> {
  constructor(@InjectModel(ModifierGroup.name) model: Model<ModifierGroup>) {
    super(model);
  }
}
