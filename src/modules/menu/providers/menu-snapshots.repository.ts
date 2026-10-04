import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lean, TenantRepository } from '@shared/tenancy/tenant-repository';

import { SnapshotCategory } from '../domain/snapshot';
import { MenuSnapshot } from '../schemas/menu-snapshot.schema';

@Injectable()
export class MenuSnapshotsRepository extends TenantRepository<MenuSnapshot> {
  constructor(@InjectModel(MenuSnapshot.name) model: Model<MenuSnapshot>) {
    super(model);
  }

  findFor(
    tenantId: Types.ObjectId,
    brandId: Types.ObjectId,
    branchId: Types.ObjectId,
  ): Promise<Lean<MenuSnapshot> | null> {
    return this.findOne(tenantId, { brandId, branchId });
  }

  /** Reemplaza el menú publicado de la sucursal y sube su versión. */
  async publish(
    tenantId: Types.ObjectId,
    brandId: Types.ObjectId,
    branchId: Types.ObjectId,
    categories: SnapshotCategory[],
  ): Promise<void> {
    await this.model
      .updateOne(
        this.scoped(tenantId, { brandId, branchId }),
        { $set: { categories, publishedAt: new Date() }, $inc: { version: 1 } },
        { upsert: true },
      )
      .exec();
  }
}
