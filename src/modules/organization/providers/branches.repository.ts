import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { Branch } from '../schemas/branch.schema';

@Injectable()
export class BranchesRepository extends TenantRepository<Branch> {
  constructor(@InjectModel(Branch.name) model: Model<Branch>) {
    super(model);
  }
}
