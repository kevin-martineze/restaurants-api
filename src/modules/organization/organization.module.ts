import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PanelBranchesController } from './controllers/panel-branches.controller';
import { BranchesRepository } from './providers/branches.repository';
import { BrandsRepository } from './providers/brands.repository';
import { TenantsRepository } from './providers/tenants.repository';
import { Branch, BranchSchema } from './schemas/branch.schema';
import { Brand, BrandSchema } from './schemas/brand.schema';
import { Tenant, TenantSchema } from './schemas/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: Brand.name, schema: BrandSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  controllers: [PanelBranchesController],
  providers: [TenantsRepository, BrandsRepository, BranchesRepository],
  exports: [TenantsRepository, BrandsRepository, BranchesRepository],
})
export class OrganizationModule {}
