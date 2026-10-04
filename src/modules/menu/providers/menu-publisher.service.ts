import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

import { buildSnapshot } from '../domain/build-snapshot';

import { BranchItemsRepository } from './branch-items.repository';
import { CategoriesRepository } from './categories.repository';
import { ItemsRepository } from './items.repository';
import { MenuSnapshotsRepository } from './menu-snapshots.repository';
import { ModifierGroupsRepository } from './modifier-groups.repository';

/**
 * Publica el menú de una sucursal: lee el modelo de escritura de la marca, le
 * aplica los cambios de la sucursal y guarda el resultado en un solo
 * documento. Se llama al editar el menú o marcar un agotado.
 */
@Injectable()
export class MenuPublisher {
  constructor(
    private readonly categories: CategoriesRepository,
    private readonly items: ItemsRepository,
    private readonly groups: ModifierGroupsRepository,
    private readonly branchItems: BranchItemsRepository,
    private readonly snapshots: MenuSnapshotsRepository,
  ) {}

  async publish(
    tenantId: Types.ObjectId,
    brandId: Types.ObjectId,
    branchId: Types.ObjectId,
  ): Promise<void> {
    const [categories, items, groups, overrides] = await Promise.all([
      this.categories.find(tenantId, { brandId }),
      this.items.find(tenantId, { brandId }),
      this.groups.find(tenantId, { brandId }),
      this.branchItems.find(tenantId, { branchId }),
    ]);

    const snapshot = buildSnapshot({
      categories: categories.map((category) => ({
        id: category._id.toString(),
        name: category.name,
        position: category.position,
        active: category.active,
      })),
      items: items.map((item) => ({
        id: item._id.toString(),
        categoryId: item.categoryId.toString(),
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        available: item.available,
        position: item.position,
        modifierGroupIds: item.modifierGroupIds.map((id) => id.toString()),
      })),
      groups: groups.map((group) => ({
        id: group._id.toString(),
        name: group.name,
        min: group.min,
        max: group.max,
        modifiers: group.modifiers.map((modifier) => ({
          id: modifier._id.toString(),
          name: modifier.name,
          priceDelta: modifier.priceDelta,
          available: modifier.available,
        })),
      })),
      overrides: overrides.map((override) => ({
        itemId: override.itemId.toString(),
        price: override.price,
        available: override.available,
      })),
    });

    await this.snapshots.publish(tenantId, brandId, branchId, snapshot);
  }
}
