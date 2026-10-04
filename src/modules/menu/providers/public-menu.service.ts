import { Injectable, NotFoundException } from '@nestjs/common';
import { OpenStatus, openStatus } from '@shared/time/schedule';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';
import { TenantsRepository } from '@modules/organization/providers/tenants.repository';
import { Branch, FulfillmentType } from '@modules/organization/schemas/branch.schema';
import { Brand } from '@modules/organization/schemas/brand.schema';
import { KitchenStatus, kitchenStatus } from '@modules/organization/domain/kitchen';
import { Lean } from '@shared/tenancy/tenant-repository';

import { Quote, QuoteRequestLine, quoteLines } from '../domain/quote';
import { SnapshotCategory, snapshotCategoriesSchema } from '../domain/snapshot';

import { MenuSnapshotsRepository } from './menu-snapshots.repository';

/** La carta tal como la recibe el frontend. */
export interface PublicMenu {
  restaurant: {
    slug: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    theme: { primary: string; primaryForeground: string };
  };
  branch: {
    id: string;
    name: string;
    address: string;
    etaMinutes: number;
    fulfillment: FulfillmentType[];
  };
  status: OpenStatus;
  kitchen: KitchenStatus;
  categories: SnapshotCategory[];
}

export interface ResolvedMenu {
  brand: Lean<Brand>;
  branch: Lean<Branch>;
  categories: SnapshotCategory[];
}

function notFound(message: string): NotFoundException {
  return new NotFoundException({ error: 'not_found', message });
}

/** Si la sucursal recibe pedidos ahora mismo, contando el botón de pausa. */
export function branchStatus(branch: Pick<Branch, 'status' | 'schedule'>, now: Date): OpenStatus {
  if (branch.status === 'paused') {
    return { open: false, label: 'Pausado · no está recibiendo pedidos por ahora' };
  }

  if (branch.status === 'closed') return { open: false, label: 'Cerrado por ahora' };

  return openStatus(branch.schedule, now);
}

@Injectable()
export class PublicMenuService {
  constructor(
    private readonly tenants: TenantsRepository,
    private readonly brands: BrandsRepository,
    private readonly branches: BranchesRepository,
    private readonly snapshots: MenuSnapshotsRepository,
  ) {}

  async getMenu(slug: string, now = new Date()): Promise<PublicMenu> {
    const { brand, branch, categories } = await this.resolve(slug);
    const kitchen = kitchenStatus(branch.kitchenLoad, branch.etaMinutes);

    return {
      restaurant: {
        slug: brand.slug,
        name: brand.name,
        tagline: brand.tagline,
        logoUrl: brand.logoUrl,
        coverUrl: brand.coverUrl,
        theme: {
          primary: brand.theme.primary,
          primaryForeground: brand.theme.primaryForeground,
        },
      },
      branch: {
        id: branch._id.toString(),
        name: branch.name,
        address: branch.address,
        // Ya corregido por la carga de la cocina: es el que se promete.
        etaMinutes: kitchen.etaMinutes,
        fulfillment: branch.fulfillment,
      },
      status: branchStatus(branch, now),
      kitchen,
      categories,
    };
  }

  async quote(slug: string, lines: QuoteRequestLine[]): Promise<Quote> {
    const { categories } = await this.resolve(slug);

    return quoteLines(categories, lines);
  }

  /**
   * Del slug público a la marca, su sucursal y su menú publicado. El checkout
   * lo reutiliza: se cotiza contra el mismo menú que ve el cliente.
   */
  async resolve(slug: string): Promise<ResolvedMenu> {
    const brand = await this.brands.findBySlug(slug);

    if (!brand) throw notFound('Este restaurante no existe.');

    const tenant = await this.tenants.findById(brand.tenantId);

    // Un restaurante suspendido no muestra su carta: para afuera, no existe.
    if (!tenant || tenant.status !== 'active') throw notFound('Este restaurante no existe.');

    const branch = brand.defaultBranchId
      ? await this.branches.findOne(brand.tenantId, { _id: brand.defaultBranchId })
      : ((await this.branches.find(brand.tenantId, { brandIds: brand._id })).at(0) ?? null);

    if (!branch) throw notFound('Este restaurante todavía no tiene una sede activa.');

    const snapshot = await this.snapshots.findFor(brand.tenantId, brand._id, branch._id);

    if (!snapshot) throw notFound('La carta de este restaurante todavía no está publicada.');

    // Lo escribió nuestro propio código; si no tiene la forma esperada es un
    // bug, y debe explotar como 500 con el detalle en el log.
    const categories = snapshotCategoriesSchema.parse(snapshot.categories);

    return { brand, branch, categories };
  }
}
