import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantRepository } from '@shared/tenancy/tenant-repository';

import { Category } from '../schemas/category.schema';

@Injectable()
export class CategoriesRepository extends TenantRepository<Category> {
  constructor(@InjectModel(Category.name) model: Model<Category>) {
    super(model);
  }
}
