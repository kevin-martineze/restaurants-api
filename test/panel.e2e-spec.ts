import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { firstValueFrom, take, timeout } from 'rxjs';
import sharp from 'sharp';
import { z } from 'zod';
import { MembershipsRepository } from '@modules/auth/providers/memberships.repository';
import { OrderEventsBus } from '@modules/orders/providers/order-events.bus';
import { FOREGROUND_DARK, FOREGROUND_LIGHT } from '@modules/organization/domain/brand-settings';
import { BrandsRepository } from '@modules/organization/providers/brands.repository';

import { DEMO_PASSWORD } from '../src/tasks/demo/la-parrilla-de-tono';
import { seedDemoRestaurant, SeededRestaurant } from '../src/tasks/demo/seed';

import { createTestApp, TestApp } from './helpers/test-app';

const sessionSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  memberships: z.array(
    z.object({
      tenantId: z.string(),
      role: z.string(),
      branches: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
});

const staffOrderSchema = z.object({
  id: z.string(),
  number: z.number(),
  status: z.string(),
  customer: z.object({ name: z.string(), phone: z.string() }),
  payment: z.object({ status: z.string() }),
  events: z.array(z.object({ status: z.string(), actorRole: z.string() })),
});

const errorSchema = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

const settingsSchema = z.object({
  name: z.string(),
  address: z.string(),
  schedule: z.array(z.object({ day: z.number(), opens: z.string(), closes: z.string() })),
  etaMinutes: z.number(),
  fulfillment: z.array(z.string()),
  location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  deliveryRings: z.array(z.object({ maxKm: z.number(), fee: z.number(), minOrder: z.number() })),
  paymentMethods: z.array(z.string()),
});

const brandSettingsSchema = z.object({
  slug: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  theme: z.object({ primary: z.string(), primaryForeground: z.string() }),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
});

describe('Panel del restaurante', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let parrilla: SeededRestaurant;
  let otro: SeededRestaurant;
  let patacon: string;
  let orderCounter = 0;
  const tokens: Record<string, string> = {};

  async function login(email: string, password = DEMO_PASSWORD) {
    return app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password },
    });
  }

  function staff(role: 'owner' | 'cashier' | 'kitchen' | 'rider') {
    const token = tokens[role];

    if (!token) throw new Error(`No hay sesión de ${role}`);

    return {
      get: (url: string) =>
        app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } }),
      post: (url: string, payload: Record<string, unknown>) =>
        app.inject({ method: 'POST', url, payload, headers: { authorization: `Bearer ${token}` } }),
      patch: (url: string, payload: Record<string, unknown>) =>
        app.inject({
          method: 'PATCH',
          url,
          payload,
          headers: { authorization: `Bearer ${token}` },
        }),
      put: (url: string, payload: Record<string, unknown>) =>
        app.inject({
          method: 'PUT',
          url,
          payload,
          headers: { authorization: `Bearer ${token}` },
        }),
      delete: (url: string) =>
        app.inject({ method: 'DELETE', url, headers: { authorization: `Bearer ${token}` } }),
    };
  }

  const base = () => `/v1/tenants/${parrilla.tenantId.toString()}`;
  const board = () => `${base()}/branches/${parrilla.branchId.toString()}/orders`;

  /** Un pedido nuevo desde la carta pública, como lo haría un cliente. */
  async function placeOrder(fulfillment: 'pickup' | 'delivery' = 'pickup') {
    orderCounter += 1;

    const response = await app.inject({
      method: 'POST',
      url: '/v1/public/la-parrilla-de-tono/orders',
      headers: { 'idempotency-key': `pedido-panel-${orderCounter.toString().padStart(6, '0')}` },
      payload: {
        lines: [{ itemId: patacon, modifierIds: [], qty: 4 }],
        fulfillment,
        ...(fulfillment === 'delivery'
          ? {
              location: { lat: 11.0035, lng: -74.8155 },
              address: { text: 'Calle 76 #54-30' },
            }
          : {}),
        customer: { name: 'Ana Pérez', phone: '300 123 4567' },
        payment: { method: 'cash' },
        consent: { service: true, marketing: false },
      },
    });

    expect(response.statusCode).toBe(201);

    const board = staffOrderSchema.array().parse((await staff('cashier').get(boardUrl())).json());
    const created = board.find(
      (order) => order.number === z.object({ number: z.number() }).parse(response.json()).number,
    );

    if (!created) throw new Error('El pedido no apareció en el tablero');

    return created;
  }

  function boardUrl() {
    return board();
  }

  async function move(
    role: 'owner' | 'cashier' | 'kitchen' | 'rider',
    orderId: string,
    to: string,
    reason?: string,
  ) {
    return staff(role).post(`${base()}/orders/${orderId}/transitions`, {
      to,
      ...(reason ? { reason } : {}),
    });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    parrilla = await seedDemoRestaurant(app);
    otro = await seedDemoRestaurant(app, { slug: 'otro-asadero', name: 'Otro Asadero' });

    const menu = z
      .object({
        categories: z.array(
          z.object({ items: z.array(z.object({ id: z.string(), name: z.string() })) }),
        ),
      })
      .parse(
        (await app.inject({ method: 'GET', url: '/v1/public/la-parrilla-de-tono/menu' })).json(),
      );
    const item = menu.categories.flatMap((c) => c.items).find((i) => i.name === 'Patacón');

    if (!item) throw new Error('La semilla no tiene patacón');

    patacon = item.id;

    const team: { role: 'owner' | 'cashier' | 'kitchen' | 'rider'; email: string }[] = [
      { role: 'owner', email: 'dueno@laparrilla.test' },
      { role: 'cashier', email: 'caja@laparrilla.test' },
      { role: 'kitchen', email: 'cocina@laparrilla.test' },
      { role: 'rider', email: 'domicilios@laparrilla.test' },
    ];

    for (const { role, email } of team) {
      tokens[role] = sessionSchema.parse((await login(email)).json()).accessToken;
    }
  });

  afterAll(async () => {
    await testApp.stop();
  });

  describe('acceso', () => {
    it('entra con correo y contraseña y trae sus restaurantes y sedes', async () => {
      const session = sessionSchema.parse((await login('CAJA@laparrilla.test')).json());

      expect(session.user.name).toBe('Caja El Prado');
      expect(session.memberships).toEqual([
        expect.objectContaining({
          tenantId: parrilla.tenantId.toString(),
          role: 'cashier',
          branches: [{ id: parrilla.branchId.toString(), name: 'Sede El Prado' }],
        }),
      ]);
    });

    it('la misma respuesta para correo inexistente y contraseña mala', async () => {
      const wrongPassword = errorSchema.parse((await login('caja@laparrilla.test', 'x')).json());
      const unknownUser = errorSchema.parse((await login('nadie@laparrilla.test')).json());

      expect(wrongPassword).toMatchObject({ statusCode: 401, error: 'invalid_credentials' });
      expect(unknownUser.message).toBe(wrongPassword.message);
    });

    it('sin sesión no hay panel', async () => {
      const response = await app.inject({ method: 'GET', url: board() });

      expect(response.statusCode).toBe(401);
    });

    it('nadie del equipo entra a otro restaurante', async () => {
      const response = await staff('owner').get(
        `/v1/tenants/${otro.tenantId.toString()}/branches/${otro.branchId.toString()}/orders`,
      );

      expect(response.statusCode).toBe(403);
    });
  });

  describe('ciclo del pedido', () => {
    it('un pedido nuevo aparece en el tablero con el teléfono del cliente', async () => {
      const order = await placeOrder();

      expect(order).toMatchObject({
        status: 'received',
        customer: { name: 'Ana Pérez', phone: '+573001234567' },
      });
    });

    it('avisa en vivo cuando entra un pedido', async () => {
      const bus = app.get(OrderEventsBus);
      const next = firstValueFrom(
        bus
          .forBranch(parrilla.tenantId.toString(), parrilla.branchId.toString())
          .pipe(take(1), timeout(5000)),
      );

      const order = await placeOrder();

      expect(await next).toMatchObject({ kind: 'created', number: order.number });
    });

    it('recorre caja → cocina → caja y al recogerlo queda cobrado', async () => {
      const order = await placeOrder('pickup');

      expect((await move('cashier', order.id, 'accepted')).statusCode).toBe(201);
      expect((await move('kitchen', order.id, 'preparing')).statusCode).toBe(201);
      expect((await move('kitchen', order.id, 'ready')).statusCode).toBe(201);

      const done = staffOrderSchema.parse((await move('cashier', order.id, 'picked_up')).json());

      expect(done.status).toBe('picked_up');
      expect(done.payment.status).toBe('collected');
      expect(done.events.map((event) => [event.status, event.actorRole])).toEqual([
        ['received', 'customer'],
        ['accepted', 'cashier'],
        ['preparing', 'kitchen'],
        ['ready', 'kitchen'],
        ['picked_up', 'cashier'],
      ]);

      // Terminado: ya no está en el tablero.
      const board = staffOrderSchema.array().parse((await staff('cashier').get(boardUrl())).json());

      expect(board.some((o) => o.id === order.id)).toBe(false);
    });

    it('el domiciliario despacha y entrega los domicilios', async () => {
      const order = await placeOrder('delivery');

      await move('cashier', order.id, 'accepted');
      await move('kitchen', order.id, 'preparing');
      await move('kitchen', order.id, 'ready');

      expect((await move('rider', order.id, 'dispatched')).statusCode).toBe(201);
      expect(
        staffOrderSchema.parse((await move('rider', order.id, 'delivered')).json()).status,
      ).toBe('delivered');
    });

    it('cada rol hace solo lo suyo', async () => {
      const order = await placeOrder();
      const response = await move('kitchen', order.id, 'accepted');

      expect(errorSchema.parse(response.json())).toMatchObject({
        statusCode: 422,
        message: 'Tu rol no permite este cambio.',
      });
    });

    it('no salta estados', async () => {
      const order = await placeOrder();
      const response = await move('cashier', order.id, 'ready');

      expect(errorSchema.parse(response.json()).message).toBe(
        'Un pedido recibido no puede pasar a listo.',
      );
    });

    it('cancelar pide motivo y lo guarda', async () => {
      const order = await placeOrder();

      expect((await move('cashier', order.id, 'cancelled')).statusCode).toBe(422);

      const cancelled = await move('cashier', order.id, 'cancelled', 'out_of_stock');

      expect(cancelled.statusCode).toBe(201);
      expect(
        z
          .object({ events: z.array(z.object({ reason: z.string().nullable() })) })
          .parse(cancelled.json())
          .events.at(-1)?.reason,
      ).toBe('out_of_stock');
    });
  });

  describe('la sede en vivo', () => {
    it('caja pausa y marca la cocina con mucha demanda; la carta lo refleja', async () => {
      const url = `${base()}/branches/${parrilla.branchId.toString()}`;
      const response = await staff('cashier').patch(url, { status: 'paused', kitchenLoad: 'busy' });

      expect(response.json()).toMatchObject({
        status: 'paused',
        kitchen: { load: 'busy', etaMinutes: 50 },
      });

      const menu = (
        await app.inject({ method: 'GET', url: '/v1/public/la-parrilla-de-tono/menu' })
      ).json();

      expect(menu).toMatchObject({ status: { open: false }, kitchen: { load: 'busy' } });

      await staff('cashier').patch(url, { status: 'open', kitchenLoad: 'calm' });
    });

    it('la cocina no puede pausar la sede', async () => {
      const response = await staff('kitchen').patch(
        `${base()}/branches/${parrilla.branchId.toString()}`,
        { status: 'paused' },
      );

      expect(response.statusCode).toBe(403);
    });
  });

  describe('configuración de la sede', () => {
    const url = () => `${base()}/branches/${parrilla.branchId.toString()}/settings`;
    let original: z.infer<typeof settingsSchema>;

    beforeAll(async () => {
      original = settingsSchema.parse((await staff('owner').get(url())).json());
    });

    afterAll(async () => {
      await staff('owner').put(url(), original);
    });

    it('el dueño guarda y relee la configuración, con los anillos ordenados', async () => {
      const response = await staff('owner').put(url(), {
        ...original,
        name: 'Sede Norte',
        etaMinutes: 45,
        deliveryRings: [
          { maxKm: 9, fee: 7000, minOrder: 40000 },
          { maxKm: 3, fee: 3000, minOrder: 20000 },
        ],
      });

      expect(response.statusCode).toBe(200);
      expect(settingsSchema.parse(response.json())).toMatchObject({
        name: 'Sede Norte',
        etaMinutes: 45,
        deliveryRings: [
          { maxKm: 3, fee: 3000, minOrder: 20000 },
          { maxKm: 9, fee: 7000, minOrder: 40000 },
        ],
      });

      expect((await staff('owner').get(url())).json()).toMatchObject({
        name: 'Sede Norte',
        etaMinutes: 45,
      });
    });

    it('rechaza domicilio sin ubicación', async () => {
      const response = await staff('owner').put(url(), {
        ...original,
        fulfillment: ['delivery', 'pickup'],
        location: null,
      });

      expect(errorSchema.parse(response.json())).toMatchObject({
        error: 'delivery_without_coverage',
      });
    });

    it('rechaza turnos del mismo día que se pisan', async () => {
      const response = await staff('owner').put(url(), {
        ...original,
        schedule: [
          { day: 1, opens: '11:00', closes: '16:00' },
          { day: 1, opens: '15:00', closes: '22:00' },
        ],
      });

      expect(errorSchema.parse(response.json())).toMatchObject({
        error: 'overlapping_schedule',
      });
    });

    it('caja y cocina no pueden ver ni cambiar la configuración', async () => {
      expect((await staff('cashier').get(url())).statusCode).toBe(403);
      expect((await staff('kitchen').put(url(), original)).statusCode).toBe(403);
    });

    it('una sede de otro restaurante no existe', async () => {
      const response = await staff('owner').get(
        `${base()}/branches/${otro.branchId.toString()}/settings`,
      );

      expect(response.statusCode).toBe(404);
    });

    it('el checkout usa los anillos nuevos', async () => {
      await staff('owner').put(url(), {
        ...original,
        deliveryRings: [{ maxKm: 50, fee: 4321, minOrder: 1000 }],
      });

      const preview = await app.inject({
        method: 'POST',
        url: '/v1/public/la-parrilla-de-tono/checkout/preview',
        payload: {
          lines: [{ itemId: patacon, modifierIds: [], qty: 1 }],
          fulfillment: 'delivery',
          location: { lat: 11.0035, lng: -74.8155 },
        },
      });

      expect(preview.json()).toMatchObject({ deliveryFee: 4321 });
    });
  });

  describe('la marca', () => {
    const settingsUrl = () => `${base()}/brands/${parrilla.brandId.toString()}/settings`;
    const logoUrl = () => `${base()}/brands/${parrilla.brandId.toString()}/logo`;
    const coverUrl = () => `${base()}/brands/${parrilla.brandId.toString()}/cover`;
    let original: z.infer<typeof brandSettingsSchema>;

    beforeAll(async () => {
      original = brandSettingsSchema.parse((await staff('owner').get(settingsUrl())).json());
    });

    afterAll(async () => {
      const brands = app.get(BrandsRepository);

      await brands.updateOne(
        parrilla.tenantId,
        { _id: parrilla.brandId },
        {
          $set: {
            name: original.name,
            tagline: original.tagline,
            theme: original.theme,
            logoUrl: original.logoUrl,
            logoKey: null,
            coverUrl: original.coverUrl,
            coverKey: null,
          },
        },
      );
    });

    function multipart(file: Buffer, mimetype: string) {
      const boundary = '----prueba-marca';
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

    async function photo() {
      return sharp({
        create: { width: 1600, height: 900, channels: 3, background: '#c0392b' },
      })
        .jpeg()
        .toBuffer();
    }

    it('el dueño guarda nombre, lema y color, con el contraste calculado', async () => {
      const response = await staff('owner').patch(settingsUrl(), {
        name: 'Parrilla Norte',
        tagline: 'Leña y mar',
        theme: { primary: '#111111' },
      });

      expect(response.statusCode).toBe(200);
      expect(brandSettingsSchema.parse(response.json())).toMatchObject({
        name: 'Parrilla Norte',
        tagline: 'Leña y mar',
        theme: { primary: '#111111', primaryForeground: FOREGROUND_LIGHT },
      });
      expect((await staff('owner').get(settingsUrl())).json()).toMatchObject({
        name: 'Parrilla Norte',
      });
    });

    it('un color claro pide texto casi negro', async () => {
      const response = await staff('owner').patch(settingsUrl(), {
        theme: { primary: '#ffffff' },
      });

      expect(brandSettingsSchema.parse(response.json()).theme.primaryForeground).toBe(
        FOREGROUND_DARK,
      );
    });

    it('rechaza un color que no es hex ni oklch', async () => {
      const response = await staff('owner').patch(settingsUrl(), {
        theme: { primary: 'rojo' },
      });

      expect(errorSchema.parse(response.json())).toMatchObject({ error: 'invalid_color' });
    });

    it('sube y quita el logo, achicándolo a 512 px', async () => {
      const { payload, headers } = multipart(await photo(), 'image/jpeg');
      const uploaded = await app.inject({ method: 'POST', url: logoUrl(), payload, headers });

      expect(uploaded.statusCode).toBe(201);

      const withLogo = brandSettingsSchema.parse(uploaded.json());

      expect(withLogo.logoUrl).not.toBeNull();

      const served = await app.inject({ method: 'GET', url: new URL(withLogo.logoUrl!).pathname });

      expect(served.statusCode).toBe(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect((await sharp(served.rawPayload).metadata()).width).toBe(512);

      const removed = brandSettingsSchema.parse((await staff('owner').delete(logoUrl())).json());

      expect(removed.logoUrl).toBeNull();
    });

    it('sube y quita la portada', async () => {
      const { payload, headers } = multipart(await photo(), 'image/jpeg');
      const uploaded = await app.inject({ method: 'POST', url: coverUrl(), payload, headers });

      expect(uploaded.statusCode).toBe(201);

      const withCover = brandSettingsSchema.parse(uploaded.json());

      expect(withCover.coverUrl).not.toBeNull();
      expect((await staff('owner').delete(coverUrl())).statusCode).toBe(200);
      expect(
        brandSettingsSchema.parse((await staff('owner').get(settingsUrl())).json()).coverUrl,
      ).toBeNull();
    });

    it('caja y cocina no ven ni cambian la marca', async () => {
      expect((await staff('cashier').get(settingsUrl())).statusCode).toBe(403);
      expect((await staff('kitchen').patch(settingsUrl(), { name: 'x' })).statusCode).toBe(403);
    });

    it('una marca de otro restaurante no existe', async () => {
      const response = await staff('owner').get(
        `${base()}/brands/${otro.brandId.toString()}/settings`,
      );

      expect(response.statusCode).toBe(404);
    });
  });

  it('quitarle el acceso a alguien surte efecto en la siguiente petición', async () => {
    const memberships = app.get(MembershipsRepository);
    const session = sessionSchema.parse((await login('domicilios@laparrilla.test')).json());

    await memberships.deleteMany(parrilla.tenantId, {
      userId: (await memberships.find(parrilla.tenantId)).find(
        (m) => m.userId.toString() === session.user.id,
      )?.userId,
    });

    const response = await staff('rider').get(board());

    expect(response.statusCode).toBe(403);
  });
});
