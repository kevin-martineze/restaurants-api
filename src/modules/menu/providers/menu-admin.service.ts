import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { StaffContext } from '@shared/auth/staff';
import { processProductImage, productImageKey } from '@shared/media/images';
import { MediaStorage } from '@shared/storage/media-storage';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';

import { groupProblem, reorder } from '../domain/menu-rules';
import { CategoryRole, ItemTag } from '../domain/snapshot';
import {
  CreateCategoryDto,
  CreateItemDto,
  GroupDto,
  UpdateCategoryDto,
  UpdateItemDto,
} from '../dtos/menu-admin.dto';

import { CategoriesRepository } from './categories.repository';
import { ItemsRepository } from './items.repository';
import { MenuPublisher } from './menu-publisher.service';
import { ModifierGroupsRepository } from './modifier-groups.repository';

/** La carta como la edita el panel: con lo inactivo y lo agotado. */
export interface AdminMenu {
  brand: { id: string; name: string; slug: string };
  categories: {
    id: string;
    name: string;
    role: CategoryRole;
    active: boolean;
    items: {
      id: string;
      categoryId: string;
      name: string;
      description: string | null;
      price: number;
      imageUrl: string | null;
      available: boolean;
      tags: ItemTag[];
      modifierGroupIds: string[];
      pairsWith: string[];
    }[];
  }[];
  groups: {
    id: string;
    name: string;
    min: number;
    max: number;
    modifiers: { id: string; name: string; priceDelta: number; available: boolean }[];
    /** Cuántos productos lo usan. */
    usedBy: number;
  }[];
}

function notFound(what: string): NotFoundException {
  return new NotFoundException({ error: 'not_found', message: `No encontramos ${what}.` });
}

function toId(value: string, what: string): Types.ObjectId {
  if (!isValidObjectId(value)) throw notFound(what);

  return new Types.ObjectId(value);
}

/**
 * Administración de la carta desde el panel.
 *
 * Cada escritura termina republicando el menú de todas las sedes de la marca:
 * lo que el dueño guarda es lo que el cliente ve en la siguiente carga.
 * Todas devuelven la carta completa, para que el panel se pinte de nuevo con
 * lo que de verdad quedó.
 */
@Injectable()
export class MenuAdminService {
  constructor(
    private readonly brands: BrandsRepository,
    private readonly categories: CategoriesRepository,
    private readonly items: ItemsRepository,
    private readonly groups: ModifierGroupsRepository,
    private readonly publisher: MenuPublisher,
    private readonly storage: MediaStorage,
  ) {}

  async menu(staff: StaffContext, brandId: string): Promise<AdminMenu> {
    const brand = await this.brandFor(staff, brandId);
    const [categories, items, groups] = await Promise.all([
      this.categories.find(staff.tenantId, { brandId: brand._id }),
      this.items.find(staff.tenantId, { brandId: brand._id }),
      this.groups.find(staff.tenantId, { brandId: brand._id }),
    ]);

    return {
      brand: { id: brand._id.toString(), name: brand.name, slug: brand.slug },
      categories: categories
        .sort((a, b) => a.position - b.position)
        .map((category) => ({
          id: category._id.toString(),
          name: category.name,
          role: category.role,
          active: category.active,
          items: items
            .filter((item) => item.categoryId.equals(category._id))
            .sort((a, b) => a.position - b.position)
            .map((item) => ({
              id: item._id.toString(),
              categoryId: item.categoryId.toString(),
              name: item.name,
              description: item.description,
              price: item.price,
              imageUrl: item.imageUrl,
              available: item.available,
              tags: item.tags,
              modifierGroupIds: item.modifierGroupIds.map((id) => id.toString()),
              pairsWith: item.pairsWith.map((id) => id.toString()),
            })),
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
        usedBy: items.filter((item) => item.modifierGroupIds.some((id) => id.equals(group._id)))
          .length,
      })),
    };
  }

  // --- Categorías ------------------------------------------------------------

  async createCategory(staff: StaffContext, brandId: string, dto: CreateCategoryDto) {
    const brand = await this.brandFor(staff, brandId);
    const existing = await this.categories.find(staff.tenantId, { brandId: brand._id });

    await this.categories.create(staff.tenantId, {
      brandId: brand._id,
      name: dto.name.trim(),
      role: dto.role ?? 'main',
      active: true,
      position: existing.length,
    });

    return this.saved(staff, brand._id, brandId);
  }

  async updateCategory(
    staff: StaffContext,
    brandId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ) {
    const brand = await this.brandFor(staff, brandId);
    const matched = await this.categories.updateOne(
      staff.tenantId,
      { _id: toId(categoryId, 'esa categoría'), brandId: brand._id },
      {
        $set: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.active !== undefined ? { active: dto.active } : {}),
        },
      },
    );

    if (matched === 0) throw notFound('esa categoría');

    return this.saved(staff, brand._id, brandId);
  }

  async deleteCategory(staff: StaffContext, brandId: string, categoryId: string) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(categoryId, 'esa categoría');
    const items = await this.items.find(staff.tenantId, { brandId: brand._id, categoryId: id });

    if (items.length > 0) {
      throw new ConflictException({
        error: 'category_not_empty',
        message: 'La categoría tiene productos. Muévelos o bórralos primero.',
      });
    }

    if ((await this.categories.deleteMany(staff.tenantId, { _id: id, brandId: brand._id })) === 0) {
      throw notFound('esa categoría');
    }

    return this.saved(staff, brand._id, brandId);
  }

  async reorderCategories(staff: StaffContext, brandId: string, ids: string[]) {
    const brand = await this.brandFor(staff, brandId);
    const categories = await this.categories.find(staff.tenantId, { brandId: brand._id });
    const current = categories
      .sort((a, b) => a.position - b.position)
      .map((category) => category._id.toString());

    for (const [position, id] of reorder(current, ids).entries()) {
      await this.categories.updateOne(
        staff.tenantId,
        { _id: new Types.ObjectId(id) },
        { $set: { position } },
      );
    }

    return this.saved(staff, brand._id, brandId);
  }

  // --- Productos -------------------------------------------------------------

  async createItem(staff: StaffContext, brandId: string, dto: CreateItemDto) {
    const brand = await this.brandFor(staff, brandId);
    const categoryId = await this.categoryIn(staff, brand._id, dto.categoryId);
    const siblings = await this.items.find(staff.tenantId, { brandId: brand._id, categoryId });

    await this.items.create(staff.tenantId, {
      brandId: brand._id,
      categoryId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      price: dto.price,
      imageUrl: null,
      imageKey: null,
      available: dto.available ?? true,
      position: siblings.length,
      tags: dto.tags ?? [],
      modifierGroupIds: await this.groupsIn(staff, brand._id, dto.modifierGroupIds ?? []),
      pairsWith: await this.itemsIn(staff, brand._id, dto.pairsWith ?? []),
    });

    return this.saved(staff, brand._id, brandId);
  }

  async updateItem(staff: StaffContext, brandId: string, itemId: string, dto: UpdateItemDto) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(itemId, 'ese producto');
    const set: Record<string, unknown> = {};

    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.description !== undefined) set.description = dto.description.trim() || null;
    if (dto.price !== undefined) set.price = dto.price;
    if (dto.available !== undefined) set.available = dto.available;
    if (dto.tags !== undefined) set.tags = dto.tags;
    if (dto.categoryId !== undefined) {
      set.categoryId = await this.categoryIn(staff, brand._id, dto.categoryId);
    }
    if (dto.modifierGroupIds !== undefined) {
      set.modifierGroupIds = await this.groupsIn(staff, brand._id, dto.modifierGroupIds);
    }
    if (dto.pairsWith !== undefined) {
      set.pairsWith = (await this.itemsIn(staff, brand._id, dto.pairsWith)).filter(
        (other) => !other.equals(id),
      );
    }

    const matched = await this.items.updateOne(
      staff.tenantId,
      { _id: id, brandId: brand._id },
      { $set: set },
    );

    if (matched === 0) throw notFound('ese producto');

    return this.saved(staff, brand._id, brandId);
  }

  async deleteItem(staff: StaffContext, brandId: string, itemId: string) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(itemId, 'ese producto');
    const item = await this.items.findOne(staff.tenantId, { _id: id, brandId: brand._id });

    if (!item || (await this.items.deleteMany(staff.tenantId, { _id: id })) === 0) {
      throw notFound('ese producto');
    }

    if (item.imageKey) await this.storage.remove([item.imageKey]);

    // Que nadie siga sugiriendo un producto que ya no existe.
    for (const other of await this.items.find(staff.tenantId, {
      brandId: brand._id,
      pairsWith: id,
    })) {
      await this.items.updateOne(staff.tenantId, { _id: other._id }, { $pull: { pairsWith: id } });
    }

    return this.saved(staff, brand._id, brandId);
  }

  async reorderItems(staff: StaffContext, brandId: string, categoryId: string, ids: string[]) {
    const brand = await this.brandFor(staff, brandId);
    const category = await this.categoryIn(staff, brand._id, categoryId);
    const items = await this.items.find(staff.tenantId, {
      brandId: brand._id,
      categoryId: category,
    });
    const current = items
      .sort((a, b) => a.position - b.position)
      .map((item) => item._id.toString());

    for (const [position, id] of reorder(current, ids).entries()) {
      await this.items.updateOne(
        staff.tenantId,
        { _id: new Types.ObjectId(id) },
        { $set: { position } },
      );
    }

    return this.saved(staff, brand._id, brandId);
  }

  /** El agotado de un toque: también lo usa la cocina. */
  async setItemAvailability(
    staff: StaffContext,
    brandId: string,
    itemId: string,
    available: boolean,
  ) {
    return this.updateItem(staff, brandId, itemId, { available });
  }

  /**
   * Sube o reemplaza la foto de un producto: se achica a 800 px en WebP y la
   * anterior, si la había subido el restaurante, se borra.
   */
  async setItemImage(staff: StaffContext, brandId: string, itemId: string, original: Buffer) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(itemId, 'ese producto');
    const item = await this.items.findOne(staff.tenantId, { _id: id, brandId: brand._id });

    if (!item) throw notFound('ese producto');

    const body = await processProductImage(original);
    const key = productImageKey(staff.tenantId.toString(), id.toString());

    await this.storage.put([{ key, body, contentType: 'image/webp' }]);
    await this.items.updateOne(
      staff.tenantId,
      { _id: id },
      { $set: { imageUrl: this.storage.publicUrl(key), imageKey: key } },
    );

    if (item.imageKey) await this.storage.remove([item.imageKey]);

    return this.saved(staff, brand._id, brandId);
  }

  async removeItemImage(staff: StaffContext, brandId: string, itemId: string) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(itemId, 'ese producto');
    const item = await this.items.findOne(staff.tenantId, { _id: id, brandId: brand._id });

    if (!item) throw notFound('ese producto');

    await this.items.updateOne(
      staff.tenantId,
      { _id: id },
      { $set: { imageUrl: null, imageKey: null } },
    );

    if (item.imageKey) await this.storage.remove([item.imageKey]);

    return this.saved(staff, brand._id, brandId);
  }

  // --- Grupos de opciones ----------------------------------------------------

  async createGroup(staff: StaffContext, brandId: string, dto: GroupDto) {
    const brand = await this.brandFor(staff, brandId);

    await this.groups.create(staff.tenantId, {
      brandId: brand._id,
      ...this.groupData(dto, []),
    });

    return this.saved(staff, brand._id, brandId);
  }

  /**
   * Reemplaza el grupo completo. Las opciones que vienen con id lo conservan:
   * un carrito abierto con "Tocineta" sigue valiendo después de cambiarle el
   * precio.
   */
  async updateGroup(staff: StaffContext, brandId: string, groupId: string, dto: GroupDto) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(groupId, 'ese grupo');
    const group = await this.groups.findOne(staff.tenantId, { _id: id, brandId: brand._id });

    if (!group) throw notFound('ese grupo');

    const existingIds = group.modifiers.map((modifier) => modifier._id.toString());

    await this.groups.updateOne(
      staff.tenantId,
      { _id: id },
      { $set: this.groupData(dto, existingIds) },
    );

    return this.saved(staff, brand._id, brandId);
  }

  async deleteGroup(staff: StaffContext, brandId: string, groupId: string) {
    const brand = await this.brandFor(staff, brandId);
    const id = toId(groupId, 'ese grupo');

    if ((await this.groups.deleteMany(staff.tenantId, { _id: id, brandId: brand._id })) === 0) {
      throw notFound('ese grupo');
    }

    for (const item of await this.items.find(staff.tenantId, {
      brandId: brand._id,
      modifierGroupIds: id,
    })) {
      await this.items.updateOne(
        staff.tenantId,
        { _id: item._id },
        { $pull: { modifierGroupIds: id } },
      );
    }

    return this.saved(staff, brand._id, brandId);
  }

  /** Agotar o devolver una opción ("se acabó la tocineta"). */
  async setModifierAvailability(
    staff: StaffContext,
    brandId: string,
    groupId: string,
    modifierId: string,
    available: boolean,
  ) {
    const brand = await this.brandFor(staff, brandId);
    const matched = await this.groups.updateOne(
      staff.tenantId,
      {
        _id: toId(groupId, 'ese grupo'),
        brandId: brand._id,
        'modifiers._id': toId(modifierId, 'esa opción'),
      },
      { $set: { 'modifiers.$.available': available } },
    );

    if (matched === 0) throw notFound('esa opción');

    return this.saved(staff, brand._id, brandId);
  }

  // --- Ayudas ----------------------------------------------------------------

  private groupData(dto: GroupDto, existingModifierIds: string[]) {
    const problem = groupProblem(dto);

    if (problem) throw new BadRequestException({ error: 'invalid_group', message: problem });

    return {
      name: dto.name.trim(),
      min: dto.min,
      max: dto.max,
      modifiers: dto.modifiers.map((modifier) => ({
        _id:
          modifier.id && existingModifierIds.includes(modifier.id)
            ? new Types.ObjectId(modifier.id)
            : new Types.ObjectId(),
        name: modifier.name.trim(),
        priceDelta: modifier.priceDelta,
        available: modifier.available,
      })),
    };
  }

  private async saved(staff: StaffContext, brand: Types.ObjectId, brandId: string) {
    await this.publisher.publishBrand(staff.tenantId, brand);

    return this.menu(staff, brandId);
  }

  private async brandFor(staff: StaffContext, brandId: string) {
    const brand = await this.brands.findOne(staff.tenantId, { _id: toId(brandId, 'esa marca') });

    if (!brand) throw notFound('esa marca');

    return brand;
  }

  private async categoryIn(
    staff: StaffContext,
    brandId: Types.ObjectId,
    categoryId: string,
  ): Promise<Types.ObjectId> {
    const id = toId(categoryId, 'esa categoría');

    if (!(await this.categories.findOne(staff.tenantId, { _id: id, brandId }))) {
      throw notFound('esa categoría');
    }

    return id;
  }

  /** Solo grupos de esta marca, sin repetir y en el orden pedido. */
  private async groupsIn(
    staff: StaffContext,
    brandId: Types.ObjectId,
    ids: string[],
  ): Promise<Types.ObjectId[]> {
    const unique = [...new Set(ids)];
    const found = await this.groups.find(staff.tenantId, {
      brandId,
      _id: { $in: unique.map((id) => toId(id, 'ese grupo')) },
    });

    if (found.length !== unique.length) throw notFound('uno de los grupos de opciones');

    return unique.map((id) => new Types.ObjectId(id));
  }

  private async itemsIn(
    staff: StaffContext,
    brandId: Types.ObjectId,
    ids: string[],
  ): Promise<Types.ObjectId[]> {
    const unique = [...new Set(ids)];
    const found = await this.items.find(staff.tenantId, {
      brandId,
      _id: { $in: unique.map((id) => toId(id, 'ese producto')) },
    });

    if (found.length !== unique.length) throw notFound('uno de los productos sugeridos');

    return unique.map((id) => new Types.ObjectId(id));
  }
}
