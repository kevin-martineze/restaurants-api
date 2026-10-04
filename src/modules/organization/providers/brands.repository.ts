import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lean, TenantRepository } from '@shared/tenancy/tenant-repository';

import { Brand } from '../schemas/brand.schema';

@Injectable()
export class BrandsRepository extends TenantRepository<Brand> {
  constructor(@InjectModel(Brand.name) model: Model<Brand>) {
    super(model);
  }

  /**
   * La única consulta sin `tenantId`: la carta pública llega solo con el slug,
   * y de aquí sale el tenant. El slug es único en toda la plataforma.
   */
  findBySlug(slug: string): Promise<Lean<Brand> | null> {
    return this.model.findOne({ slug }).lean<Lean<Brand>>().exec();
  }
}
