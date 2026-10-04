import { INestApplicationContext } from '@nestjs/common';
import { Types } from 'mongoose';
import { MembershipsRepository } from '@modules/auth/providers/memberships.repository';
import { PasswordService } from '@modules/auth/providers/password.service';
import { UsersRepository } from '@modules/auth/providers/users.repository';
import { CustomersRepository } from '@modules/customers/providers/customers.repository';
import { BranchItemsRepository } from '@modules/menu/providers/branch-items.repository';
import { CategoriesRepository } from '@modules/menu/providers/categories.repository';
import { ItemsRepository } from '@modules/menu/providers/items.repository';
import { MenuPublisher } from '@modules/menu/providers/menu-publisher.service';
import { MenuSnapshotsRepository } from '@modules/menu/providers/menu-snapshots.repository';
import { ModifierGroupsRepository } from '@modules/menu/providers/modifier-groups.repository';
import { OrderCountersRepository } from '@modules/orders/providers/order-counters.repository';
import { OrdersRepository } from '@modules/orders/providers/orders.repository';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';
import { TenantsRepository } from '@modules/organization/providers/tenants.repository';

import {
  DEMO_BRANCH,
  DEMO_BRAND,
  DEMO_CATEGORIES,
  DEMO_GROUPS,
  DEMO_PASSWORD,
  DEMO_SLUG,
  DEMO_TEAM,
} from './la-parrilla-de-tono';
import { DEMO_PHOTOS } from './photos';

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
  const orders = app.get(OrdersRepository);
  const counters = app.get(OrderCountersRepository);
  const customers = app.get(CustomersRepository);
  const users = app.get(UsersRepository);
  const memberships = app.get(MembershipsRepository);
  const passwords = app.get(PasswordService);

  const slug = overrides.slug ?? DEMO_SLUG;
  const name = overrides.name ?? DEMO_BRAND.name;
  const existing = await brands.findBySlug(slug);

  if (existing) {
    const tenantId = existing.tenantId;

    // Uno por uno y no en paralelo: `deleteMany` no se reintenta solo, y abrir
    // varias conexiones a la vez contra Mongo en Podman sin root a veces
    // termina en ECONNRESET a mitad de la semilla.
    for (const repository of [
      memberships,
      orders,
      customers,
      snapshots,
      branchItems,
      items,
      groups,
      categories,
      branches,
      brands,
    ]) {
      await repository.deleteMany(tenantId);
    }

    await counters.deleteForTenant(tenantId);
    await tenants.deleteById(tenantId);
  }

  const tenantId = await tenants.create({ name });
  const brandId = await brands.create(tenantId, {
    ...DEMO_BRAND,
    name,
    slug,
    logoUrl: null,
    coverUrl: DEMO_PHOTOS.cover?.url ?? null,
    defaultBranchId: null,
  });
  const branchId = await branches.create(tenantId, {
    ...DEMO_BRANCH,
    brandIds: [brandId],
    timezone: 'America/Bogota',
    status: 'open',
    fulfillment: ['delivery', 'pickup'],
    kitchenLoad: 'calm',
    paymentMethods: ['cash', 'card_on_delivery'],
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

  const itemIds = new Map<string, Types.ObjectId>();

  for (const [position, category] of DEMO_CATEGORIES.entries()) {
    const categoryId = await categories.create(tenantId, {
      brandId,
      name: category.name,
      position,
      active: true,
      role: category.role ?? 'main',
    });

    for (const [itemPosition, item] of category.items.entries()) {
      const itemId = await items.create(tenantId, {
        brandId,
        categoryId,
        name: item.name,
        description: item.description ?? null,
        price: item.price,
        imageUrl: DEMO_PHOTOS[item.name]?.url ?? null,
        available: item.available ?? true,
        position: itemPosition,
        tags: item.tags ?? [],
        pairsWith: [],
        modifierGroupIds: (item.groups ?? []).flatMap((key) => {
          const id = groupIds.get(key);

          return id ? [id] : [];
        }),
      });

      itemIds.set(item.name, itemId);
    }
  }

  // Las sugerencias a mano apuntan a productos que ya existen: segunda pasada.
  for (const category of DEMO_CATEGORIES) {
    for (const item of category.items) {
      const itemId = itemIds.get(item.name);
      const pairsWith = (item.pairsWith ?? []).flatMap((name) => {
        const id = itemIds.get(name);

        return id ? [id] : [];
      });

      if (itemId && pairsWith.length > 0) {
        await items.updateOne(tenantId, { _id: itemId }, { pairsWith });
      }
    }
  }

  await publisher.publish(tenantId, brandId, branchId);

  // El equipo solo existe para el slug de la demostración: las pruebas siembran
  // otros restaurantes y no deben robarle los usuarios.
  if (slug === DEMO_SLUG) {
    const passwordHash = await passwords.hash(DEMO_PASSWORD);

    for (const member of DEMO_TEAM) {
      const userId = await users.upsert({ email: member.email, name: member.name, passwordHash });

      await memberships.create(tenantId, { userId, role: member.role, branchIds: [] });
    }
  }

  return { tenantId, brandId, branchId };
}
