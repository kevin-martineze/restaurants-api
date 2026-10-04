import { INestApplicationContext } from '@nestjs/common';
import { Types } from 'mongoose';
import { BranchItemsRepository } from '@modules/menu/providers/branch-items.repository';
import { CategoriesRepository } from '@modules/menu/providers/categories.repository';
import { ItemsRepository } from '@modules/menu/providers/items.repository';
import { MenuPublisher } from '@modules/menu/providers/menu-publisher.service';
import { MenuSnapshotsRepository } from '@modules/menu/providers/menu-snapshots.repository';
import { ModifierGroupsRepository } from '@modules/menu/providers/modifier-groups.repository';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';
import { TenantsRepository } from '@modules/organization/providers/tenants.repository';

import {
  DEMO_BRANCH,
  DEMO_BRAND,
  DEMO_CATEGORIES,
  DEMO_GROUPS,
  DEMO_SLUG,
} from './la-parrilla-de-tono';

export interface SeededRestaurant {
  tenantId: Types.ObjectId;
  brandId: Types.ObjectId;
  branchId: Types.ObjectId;
}

interface Overrides {
  /** Para sembrar varios restaurantes en una misma base (pruebas de aislamiento). */
  slug?: string;
  name?: string;
}

/**
 * Carga el restaurante de demostración y publica su menú.
 *
 * Es idempotente: si ya existe una marca con ese slug, borra todo su tenant y
 * lo vuelve a crear, así `pnpm db:seed` siempre deja la misma carta.
 */
export async function seedDemoRestaurant(
  app: INestApplicationContext,
  overrides: Overrides = {},
): Promise<SeededRestaurant> {
  const tenants = app.get(TenantsRepository);
  const brands = app.get(BrandsRepository);
  const branches = app.get(BranchesRepository);
  const categories = app.get(CategoriesRepository);
  const items = app.get(ItemsRepository);
  const groups = app.get(ModifierGroupsRepository);
  const branchItems = app.get(BranchItemsRepository);
  const snapshots = app.get(MenuSnapshotsRepository);
  const publisher = app.get(MenuPublisher);

  const slug = overrides.slug ?? DEMO_SLUG;
  const name = overrides.name ?? DEMO_BRAND.name;
  const existing = await brands.findBySlug(slug);

  if (existing) {
    const tenantId = existing.tenantId;

    await Promise.all([
      snapshots.deleteMany(tenantId),
      branchItems.deleteMany(tenantId),
      items.deleteMany(tenantId),
      groups.deleteMany(tenantId),
      categories.deleteMany(tenantId),
      branches.deleteMany(tenantId),
      brands.deleteMany(tenantId),
    ]);
    await tenants.deleteById(tenantId);
  }

  const tenantId = await tenants.create({ name });
  const brandId = await brands.create(tenantId, {
    ...DEMO_BRAND,
    name,
    slug,
    logoUrl: null,
    defaultBranchId: null,
  });
  const branchId = await branches.create(tenantId, {
    ...DEMO_BRANCH,
    brandIds: [brandId],
    timezone: 'America/Bogota',
    status: 'open',
    fulfillment: ['delivery', 'pickup'],
  });

  await brands.updateOne(tenantId, { _id: brandId }, { defaultBranchId: branchId });

  const groupIds = new Map<string, Types.ObjectId>();

  for (const [key, group] of Object.entries(DEMO_GROUPS)) {
    const id = await groups.create(tenantId, {
      brandId,
      name: group.name,
      min: group.min,
      max: group.max,
      modifiers: group.modifiers.map((modifier) => ({
        _id: new Types.ObjectId(),
        name: modifier.name,
        priceDelta: modifier.priceDelta ?? 0,
        available: modifier.available ?? true,
      })),
    });

    groupIds.set(key, id);
  }

  for (const [position, category] of DEMO_CATEGORIES.entries()) {
    const categoryId = await categories.create(tenantId, {
      brandId,
      name: category.name,
      position,
      active: true,
    });

    for (const [itemPosition, item] of category.items.entries()) {
      await items.create(tenantId, {
        brandId,
        categoryId,
        name: item.name,
        description: item.description ?? null,
        price: item.price,
        imageUrl: null,
        available: item.available ?? true,
        position: itemPosition,
        modifierGroupIds: (item.groups ?? []).flatMap((key) => {
          const id = groupIds.get(key);

          return id ? [id] : [];
        }),
      });
    }
  }

  await publisher.publish(tenantId, brandId, branchId);

  return { tenantId, brandId, branchId };
}
