import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { z } from 'zod';
import { ItemsRepository } from '@modules/menu/providers/items.repository';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant } from '@modules/organization/schemas/tenant.schema';

import { seedDemoRestaurant, SeededRestaurant } from '../src/tasks/demo/seed';

import { createTestApp, TestApp } from './helpers/test-app';

const menuSchema = z.object({
  restaurant: z.object({ slug: z.string(), name: z.string() }),
  status: z.object({ open: z.boolean(), label: z.string() }),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          available: z.boolean(),
          groups: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              modifiers: z.array(
                z.object({ id: z.string(), name: z.string(), available: z.boolean() }),
              ),
            }),
          ),
        }),
      ),
    }),
  ),
});

const quoteSchema = z.object({
  lines: z.array(z.object({ index: z.number(), unitPrice: z.number(), total: z.number() })),
  rejected: z.array(z.object({ index: z.number(), name: z.string(), reason: z.string() })),
  subtotal: z.number(),
});

const errorSchema = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

type Menu = z.infer<typeof menuSchema>;

function itemNamed(menu: Menu, name: string) {
  const item = menu.categories.flatMap((category) => category.items).find((i) => i.name === name);

  if (!item) throw new Error(`No está «${name}» en la carta`);

  return item;
}

function modifierNamed(item: Menu['categories'][number]['items'][number], name: string): string {
  const modifier = item.groups.flatMap((group) => group.modifiers).find((m) => m.name === name);

  if (!modifier) throw new Error(`«${item.name}» no tiene la opción «${name}»`);

  return modifier.id;
}

describe('Carta pública', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let parrilla: SeededRestaurant;
  let otro: SeededRestaurant;

  async function getMenu(slug: string): Promise<Menu> {
    const response = await app.inject({ method: 'GET', url: `/v1/public/${slug}/menu` });

    expect(response.statusCode).toBe(200);

    return menuSchema.parse(response.json());
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    parrilla = await seedDemoRestaurant(app);
    otro = await seedDemoRestaurant(app, { slug: 'otro-asadero', name: 'Otro Asadero' });
  });

  afterAll(async () => {
    await testApp.stop();
  });

  it('sirve la carta publicada en el orden de la marca', async () => {
    const menu = await getMenu('la-parrilla-de-tono');

    expect(menu.restaurant.name).toBe('La Parrilla de Toño');
    expect(menu.categories.map((category) => category.name)).toEqual([
      'Hamburguesas',
      'Perros calientes',
      'Asados',
      'Picadas',
      'Combos',
      'Acompañantes',
      'Bebidas',
    ]);
    expect(itemNamed(menu, 'Doble').available).toBe(false);
    expect(menu.status.label).toMatch(/^(Abierto|Cerrado)/);
  });

  it('responde 404 en español para un restaurante que no existe', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/public/no-existe/menu' });

    expect(response.statusCode).toBe(404);
    expect(errorSchema.parse(response.json())).toMatchObject({
      error: 'not_found',
      message: 'Este restaurante no existe.',
    });
  });

  it('cotiza con los precios del servidor y rechaza lo que no se puede preparar', async () => {
    const menu = await getMenu('la-parrilla-de-tono');
    const sencilla = itemNamed(menu, 'Sencilla');
    const doble = itemNamed(menu, 'Doble');

    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/la-parrilla-de-tono/quote',
      payload: {
        lines: [
          {
            itemId: sencilla.id,
            modifierIds: [modifierNamed(sencilla, 'Medio'), modifierNamed(sencilla, 'Tocineta')],
            note: '  sin   cebolla ',
            qty: 2,
          },
          { itemId: doble.id, modifierIds: [modifierNamed(doble, 'Medio')], qty: 1 },
          { itemId: sencilla.id, modifierIds: [], qty: 1 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);

    const quote = quoteSchema.parse(response.json());

    expect(quote.lines).toEqual([expect.objectContaining({ index: 0, unitPrice: 21000 })]);
    expect(quote.rejected).toEqual([
      { index: 1, name: 'Doble', reason: '«Doble» se agotó.' },
      { index: 2, name: 'Sencilla', reason: 'Elige una opción en «Término de la carne».' },
    ]);
    expect(quote.subtotal).toBe(42000);
  });

  it('rechaza un carrito mal formado con un mensaje en español', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/la-parrilla-de-tono/quote',
      payload: { lines: [{ itemId: 'x', modifierIds: [], qty: 0, price: 1 }] },
    });

    expect(response.statusCode).toBe(400);
    expect(errorSchema.parse(response.json()).message).toBe('La información enviada no es válida.');
  });

  describe('aislamiento entre restaurantes', () => {
    it('un producto de un restaurante no se puede cotizar en otro', async () => {
      const menu = await getMenu('la-parrilla-de-tono');
      const patacon = itemNamed(menu, 'Patacón');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/public/otro-asadero/quote',
        payload: { lines: [{ itemId: patacon.id, modifierIds: [], qty: 1 }] },
      });

      expect(quoteSchema.parse(response.json()).rejected[0]?.reason).toBe(
        'Este producto ya no está en la carta.',
      );
    });

    it('el repositorio no lee ni modifica datos de otro tenant', async () => {
      const items = app.get(ItemsRepository);
      const own = await items.find(parrilla.tenantId);
      const target = own[0];

      if (!target) throw new Error('La semilla no creó productos');

      expect(await items.findOne(otro.tenantId, { _id: target._id })).toBeNull();
      expect(await items.updateOne(otro.tenantId, { _id: target._id }, { price: 1 })).toBe(0);
      expect(await items.deleteMany(otro.tenantId, { _id: target._id })).toBe(0);
      expect((await items.findOne(parrilla.tenantId, { _id: target._id }))?.price).toBe(
        target.price,
      );
    });
  });

  it('una sede en pausa muestra la carta pero no recibe pedidos', async () => {
    const branches = app.get(BranchesRepository);

    await branches.updateOne(otro.tenantId, { _id: otro.branchId }, { status: 'paused' });

    const menu = await getMenu('otro-asadero');

    expect(menu.status).toEqual({
      open: false,
      label: 'Pausado · no está recibiendo pedidos por ahora',
    });
  });

  it('la carga de la cocina corrige el tiempo estimado que se promete', async () => {
    const branches = app.get(BranchesRepository);

    await branches.updateOne(
      parrilla.tenantId,
      { _id: parrilla.branchId },
      { kitchenLoad: 'busy' },
    );

    const response = await app.inject({
      method: 'GET',
      url: '/v1/public/la-parrilla-de-tono/menu',
    });
    const body = z
      .object({
        branch: z.object({ etaMinutes: z.number() }),
        kitchen: z.object({ load: z.string(), label: z.string(), etaMinutes: z.number() }),
      })
      .parse(response.json());

    expect(body.kitchen).toEqual({ load: 'busy', label: 'Mucha demanda', etaMinutes: 50 });
    expect(body.branch.etaMinutes).toBe(50);

    await branches.updateOne(
      parrilla.tenantId,
      { _id: parrilla.branchId },
      { kitchenLoad: 'calm' },
    );
  });

  it('un restaurante suspendido no muestra su carta', async () => {
    const tenants = app.get<Model<Tenant>>(getModelToken(Tenant.name));

    await tenants.updateOne({ _id: otro.tenantId }, { status: 'suspended' });

    const response = await app.inject({ method: 'GET', url: '/v1/public/otro-asadero/menu' });

    expect(response.statusCode).toBe(404);
  });
});
