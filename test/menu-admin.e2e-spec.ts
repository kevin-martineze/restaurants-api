import { NestFastifyApplication } from '@nestjs/platform-fastify';
import sharp from 'sharp';
import { z } from 'zod';

import { DEMO_PASSWORD } from '../src/tasks/demo/la-parrilla-de-tono';
import { seedDemoRestaurant, SeededRestaurant } from '../src/tasks/demo/seed';

import { createTestApp, TestApp } from './helpers/test-app';

const adminMenuSchema = z.object({
  brand: z.object({ id: z.string(), slug: z.string() }),
  categories: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string(),
      active: z.boolean(),
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          price: z.number(),
          available: z.boolean(),
          imageUrl: z.string().nullable(),
          modifierGroupIds: z.array(z.string()),
        }),
      ),
    }),
  ),
  groups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      min: z.number(),
      max: z.number(),
      usedBy: z.number(),
      modifiers: z.array(z.object({ id: z.string(), name: z.string(), available: z.boolean() })),
    }),
  ),
});

const publicMenuSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string(),
      items: z.array(z.object({ id: z.string(), name: z.string(), available: z.boolean() })),
    }),
  ),
});

const errorSchema = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

type AdminMenu = z.infer<typeof adminMenuSchema>;

describe('Administración de la carta', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let parrilla: SeededRestaurant;
  let otro: SeededRestaurant;
  const tokens: Record<string, string> = {};

  function as(role: 'owner' | 'kitchen') {
    const headers = { authorization: `Bearer ${tokens[role] ?? ''}` };

    return {
      get: (url: string) => app.inject({ method: 'GET', url, headers }),
      post: (url: string, payload: Record<string, unknown>) =>
        app.inject({ method: 'POST', url, payload, headers }),
      patch: (url: string, payload: Record<string, unknown>) =>
        app.inject({ method: 'PATCH', url, payload, headers }),
      delete: (url: string) => app.inject({ method: 'DELETE', url, headers }),
    };
  }

  const menuUrl = () =>
    `/v1/tenants/${parrilla.tenantId.toString()}/brands/${parrilla.brandId.toString()}/menu`;

  async function adminMenu(): Promise<AdminMenu> {
    return adminMenuSchema.parse((await as('owner').get(menuUrl())).json());
  }

  async function publicMenu() {
    return publicMenuSchema.parse(
      (await app.inject({ method: 'GET', url: '/v1/public/la-parrilla-de-tono/menu' })).json(),
    );
  }

  function itemNamed(menu: AdminMenu, name: string) {
    const item = menu.categories.flatMap((c) => c.items).find((i) => i.name === name);

    if (!item) throw new Error(`No está «${name}»`);

    return item;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    parrilla = await seedDemoRestaurant(app);
    otro = await seedDemoRestaurant(app, { slug: 'otro-asadero', name: 'Otro Asadero' });

    for (const [role, email] of [
      ['owner', 'dueno@laparrilla.test'],
      ['kitchen', 'cocina@laparrilla.test'],
    ]) {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email, password: DEMO_PASSWORD },
      });

      tokens[role ?? ''] = z.object({ accessToken: z.string() }).parse(response.json()).accessToken;
    }
  });

  afterAll(async () => {
    await testApp.stop();
  });

  it('trae la carta completa con cuántos productos usan cada grupo', async () => {
    const menu = await adminMenu();

    expect(menu.categories).toHaveLength(7);
    expect(menu.groups.find((g) => g.name === 'Término de la carne')?.usedBy).toBe(5);
  });

  it('crear una categoría y un producto los publica en la carta del cliente', async () => {
    const withCategory = adminMenuSchema.parse(
      (
        await as('owner').post(`${menuUrl()}/categories`, { name: 'Postres', role: 'dessert' })
      ).json(),
    );
    const postres = withCategory.categories.at(-1);

    expect(postres).toMatchObject({ name: 'Postres', role: 'dessert' });

    const created = await as('owner').post(`${menuUrl()}/items`, {
      categoryId: postres?.id,
      name: 'Enyucado',
      description: 'De la abuela, con coco y queso costeño.',
      price: 7000,
      tags: ['new'],
    });

    expect(created.statusCode).toBe(201);

    const published = await publicMenu();

    expect(published.categories.at(-1)).toMatchObject({
      name: 'Postres',
      items: [expect.objectContaining({ name: 'Enyucado', available: true })],
    });
  });

  it('no acepta precios con decimales ni grupos imposibles', async () => {
    const menu = await adminMenu();
    const decimals = await as('owner').post(`${menuUrl()}/items`, {
      categoryId: menu.categories[0]?.id,
      name: 'Raro',
      price: 1500.5,
    });

    expect(decimals.statusCode).toBe(400);

    const impossible = await as('owner').post(`${menuUrl()}/groups`, {
      name: 'Salsas',
      min: 0,
      max: 3,
      modifiers: [{ name: 'Rosada', priceDelta: 0, available: true }],
    });

    expect(errorSchema.parse(impossible.json()).message).toBe(
      'No se pueden elegir 3 opciones si el grupo tiene 1.',
    );
  });

  it('editar un grupo conserva los ids de sus opciones', async () => {
    const before = await adminMenu();
    const adiciones = before.groups.find((g) => g.name === 'Adiciones' && g.usedBy === 3);

    if (!adiciones) throw new Error('Falta el grupo de adiciones');

    const updated = adminMenuSchema.parse(
      (
        await as('owner').patch(`${menuUrl()}/groups/${adiciones.id}`, {
          name: 'Adiciones',
          min: 0,
          max: 2,
          modifiers: [
            ...adiciones.modifiers.slice(0, 2).map((m) => ({
              id: m.id,
              name: m.name,
              priceDelta: 3500,
              available: true,
            })),
            { name: 'Cebolla caramelizada', priceDelta: 2000, available: true },
          ],
        })
      ).json(),
    );
    const after = updated.groups.find((g) => g.id === adiciones.id);

    expect(after?.max).toBe(2);
    expect(after?.modifiers.slice(0, 2).map((m) => m.id)).toEqual(
      adiciones.modifiers.slice(0, 2).map((m) => m.id),
    );
    expect(after?.modifiers[2]?.name).toBe('Cebolla caramelizada');
  });

  it('la cocina agota un producto de un toque y la carta lo muestra', async () => {
    const item = itemNamed(await adminMenu(), 'Patacón');
    const response = await as('kitchen').patch(`${menuUrl()}/items/${item.id}/availability`, {
      available: false,
    });

    expect(response.statusCode).toBe(200);

    const patacon = (await publicMenu()).categories
      .flatMap((c) => c.items)
      .find((i) => i.id === item.id);

    expect(patacon?.available).toBe(false);
  });

  it('la cocina no edita la carta', async () => {
    const menu = await adminMenu();
    const response = await as('kitchen').post(`${menuUrl()}/items`, {
      categoryId: menu.categories[0]?.id,
      name: 'Intento',
      price: 1000,
    });

    expect(response.statusCode).toBe(403);
  });

  it('no borra una categoría con productos', async () => {
    const menu = await adminMenu();
    const response = await as('owner').delete(`${menuUrl()}/categories/${menu.categories[0]?.id}`);

    expect(errorSchema.parse(response.json())).toMatchObject({
      statusCode: 409,
      message: 'La categoría tiene productos. Muévelos o bórralos primero.',
    });
  });

  it('borrar un grupo lo quita de los productos que lo usaban', async () => {
    const menu = await adminMenu();
    const termino = menu.groups.find((g) => g.name === 'Término de la carne');

    if (!termino) throw new Error('Falta el grupo de término');

    const after = adminMenuSchema.parse(
      (await as('owner').delete(`${menuUrl()}/groups/${termino.id}`)).json(),
    );

    expect(after.groups.some((g) => g.id === termino.id)).toBe(false);
    expect(
      after.categories.flatMap((c) => c.items).some((i) => i.modifierGroupIds.includes(termino.id)),
    ).toBe(false);
  });

  it('reordena las categorías', async () => {
    const menu = await adminMenu();
    const bebidas = menu.categories.find((c) => c.name === 'Bebidas');
    const after = adminMenuSchema.parse(
      (await as('owner').post(`${menuUrl()}/categories/reorder`, { ids: [bebidas?.id] })).json(),
    );

    expect(after.categories[0]?.name).toBe('Bebidas');
    expect((await publicMenu()).categories[0]?.name).toBe('Bebidas');
  });

  describe('fotos', () => {
    /** Un cuerpo multipart con un solo archivo, como lo manda el navegador. */
    function multipart(file: Buffer, mimetype: string) {
      const boundary = '----prueba-foto';
      const head = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="foto"\r\nContent-Type: ${mimetype}\r\n\r\n`,
      );
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

      return {
        payload: Buffer.concat([head, file, tail]),
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${tokens.owner ?? ''}`,
        },
      };
    }

    async function upload(itemId: string, file: Buffer, mimetype = 'image/jpeg') {
      const { payload, headers } = multipart(file, mimetype);

      return app.inject({
        method: 'POST',
        url: `${menuUrl()}/items/${itemId}/image`,
        payload,
        headers,
      });
    }

    function mediaPath(url: string | null | undefined): string {
      return new URL(url ?? '').pathname;
    }

    it('achica la foto a 800 px en WebP, la sirve y borra la anterior al reemplazarla', async () => {
      const item = itemNamed(await adminMenu(), 'Sencilla');
      const photo = await sharp({
        create: { width: 2400, height: 1800, channels: 3, background: '#c0392b' },
      })
        .jpeg()
        .toBuffer();

      const first = adminMenuSchema.parse((await upload(item.id, photo)).json());
      const firstUrl = itemNamed(first, 'Sencilla').imageUrl;
      const served = await app.inject({ method: 'GET', url: mediaPath(firstUrl) });

      expect(served.statusCode).toBe(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect((await sharp(served.rawPayload).metadata()).width).toBe(800);

      const second = adminMenuSchema.parse((await upload(item.id, photo)).json());
      const secondUrl = itemNamed(second, 'Sencilla').imageUrl;

      expect(secondUrl).not.toBe(firstUrl);
      expect((await app.inject({ method: 'GET', url: mediaPath(firstUrl) })).statusCode).toBe(404);

      // La carta del cliente ya muestra la foto nueva.
      const published = z
        .object({
          categories: z.array(
            z.object({
              items: z.array(z.object({ id: z.string(), imageUrl: z.string().nullable() })),
            }),
          ),
        })
        .parse(
          (await app.inject({ method: 'GET', url: '/v1/public/la-parrilla-de-tono/menu' })).json(),
        );

      expect(
        published.categories.flatMap((c) => c.items).find((i) => i.id === item.id)?.imageUrl,
      ).toBe(secondUrl);
    });

    it('rechaza lo que no es una imagen', async () => {
      const item = itemNamed(await adminMenu(), 'Costeña');
      const response = await upload(item.id, Buffer.from('no soy una foto'), 'image/png');

      expect(errorSchema.parse(response.json()).message).toBe('El archivo no es una imagen.');
    });

    it('la cocina no sube fotos', async () => {
      const item = itemNamed(await adminMenu(), 'Costeña');
      const { payload, headers } = multipart(Buffer.from('x'), 'image/png');
      const response = await app.inject({
        method: 'POST',
        url: `${menuUrl()}/items/${item.id}/image`,
        payload,
        headers: { ...headers, authorization: `Bearer ${tokens.kitchen ?? ''}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  it('no se puede editar la carta de otro restaurante', async () => {
    const response = await as('owner').get(
      `/v1/tenants/${otro.tenantId.toString()}/brands/${otro.brandId.toString()}/menu`,
    );

    expect(response.statusCode).toBe(403);

    const crossBrand = await as('owner').get(
      `/v1/tenants/${parrilla.tenantId.toString()}/brands/${otro.brandId.toString()}/menu`,
    );

    expect(crossBrand.statusCode).toBe(404);
  });
});
