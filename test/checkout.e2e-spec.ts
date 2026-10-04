import { getModelToken } from '@nestjs/mongoose';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Customer } from '@modules/customers/schemas/customer.schema';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';

import { seedDemoRestaurant, SeededRestaurant } from '../src/tasks/demo/seed';

import { createTestApp, TestApp } from './helpers/test-app';

const menuSchema = z.object({
  categories: z.array(
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          groups: z.array(
            z.object({ modifiers: z.array(z.object({ id: z.string(), name: z.string() })) }),
          ),
        }),
      ),
    }),
  ),
});

const previewSchema = z.object({
  subtotal: z.number(),
  deliveryFee: z.number(),
  total: z.number(),
  minOrder: z.number(),
  distanceKm: z.number().nullable(),
  blockers: z.array(z.string()),
  etaMinutes: z.number(),
  paymentMethods: z.array(z.string()),
});

const createdSchema = z.object({
  number: z.number(),
  trackingToken: z.string(),
  total: z.number(),
  etaMinutes: z.number(),
});

const errorSchema = z.object({ statusCode: z.number(), error: z.string(), message: z.string() });

// Alto Prado: a ~1,2 km de la sede (anillo de 3 km: $3.000, mínimo $20.000).
const ALTO_PRADO = { lat: 11.0035, lng: -74.8155 };
// Soledad: fuera de los 9 km.
const SOLEDAD = { lat: 10.9184, lng: -74.7646 };

describe('Checkout', () => {
  let testApp: TestApp;
  let app: NestFastifyApplication;
  let parrilla: SeededRestaurant;
  let line: { itemId: string; modifierIds: string[]; qty: number };
  let keyCounter = 0;

  /** Una clave de idempotencia nueva por pedido. */
  function newKey(): string {
    keyCounter += 1;

    return `prueba-pedido-${keyCounter.toString().padStart(4, '0')}`;
  }

  function order(overrides: Record<string, unknown> = {}) {
    return {
      lines: [line],
      fulfillment: 'delivery',
      location: ALTO_PRADO,
      customer: { name: 'Ana Pérez', phone: '300 123 4567' },
      address: { text: 'Calle 76 #54-30', neighborhood: 'Alto Prado', references: 'Portón negro' },
      payment: { method: 'cash', cashTendered: 50000 },
      consent: { service: true, marketing: false },
      ...overrides,
    };
  }

  function post(path: string, payload: unknown, key?: string) {
    return app.inject({
      method: 'POST',
      url: `/v1/public/la-parrilla-de-tono${path}`,
      payload: JSON.stringify(payload),
      headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
    });
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    app = testApp.app;
    parrilla = await seedDemoRestaurant(app);

    // Abierto las 24 horas: las pruebas no pueden depender de la hora en que corren.
    await app.get(BranchesRepository).updateOne(
      parrilla.tenantId,
      { _id: parrilla.branchId },
      {
        schedule: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, opens: '00:00', closes: '00:00' })),
      },
    );

    const menu = menuSchema.parse(
      (await app.inject({ method: 'GET', url: '/v1/public/la-parrilla-de-tono/menu' })).json(),
    );
    const sencilla = menu.categories.flatMap((c) => c.items).find((i) => i.name === 'Sencilla');
    const medio = sencilla?.groups.flatMap((g) => g.modifiers).find((m) => m.name === 'Medio');

    if (!sencilla || !medio) throw new Error('La semilla no tiene la hamburguesa sencilla');

    // 2 × $18.000 = $36.000
    line = { itemId: sencilla.id, modifierIds: [medio.id], qty: 2 };
  });

  afterAll(async () => {
    await testApp.stop();
  });

  describe('vista previa', () => {
    it('suma el domicilio del anillo donde cae el punto', async () => {
      const response = await post('/checkout/preview', {
        lines: [line],
        fulfillment: 'delivery',
        location: ALTO_PRADO,
      });

      expect(previewSchema.parse(response.json())).toMatchObject({
        subtotal: 36000,
        deliveryFee: 3000,
        total: 39000,
        minOrder: 20000,
        blockers: [],
        paymentMethods: ['cash', 'card_on_delivery'],
      });
    });

    it('para recoger no cobra domicilio', async () => {
      const response = await post('/checkout/preview', { lines: [line], fulfillment: 'pickup' });

      expect(previewSchema.parse(response.json())).toMatchObject({
        deliveryFee: 0,
        total: 36000,
        blockers: [],
      });
    });

    it('fuera de cobertura dice hasta dónde no llegamos', async () => {
      const response = await post('/checkout/preview', {
        lines: [line],
        fulfillment: 'delivery',
        location: SOLEDAD,
      });

      expect(previewSchema.parse(response.json()).blockers[0]).toMatch(
        /^Todavía no llegamos hasta allá/,
      );
    });
  });

  describe('crear el pedido', () => {
    it('crea el pedido con número consecutivo y la misma clave devuelve el mismo', async () => {
      const key = newKey();
      const first = createdSchema.parse((await post('/orders', order(), key)).json());
      const again = createdSchema.parse((await post('/orders', order(), key)).json());
      const second = createdSchema.parse((await post('/orders', order(), newKey())).json());

      expect(first).toMatchObject({ number: 1, total: 39000 });
      expect(again).toEqual(first);
      expect(second.number).toBe(2);
    });

    it('guarda al cliente con su celular normalizado, su dirección y su autorización', async () => {
      const customers = app.get<Model<Customer>>(getModelToken(Customer.name));
      const customer = await customers.findOne({ tenantId: parrilla.tenantId }).lean();

      expect(customer).toMatchObject({
        phone: '+573001234567',
        name: 'Ana Pérez',
        stats: { orders: 2 },
        consent: { marketing: false, version: '2026-10-v1' },
      });
      expect(customer?.addresses).toHaveLength(2);
      expect(customer?.addresses[0]).toMatchObject({
        text: 'Calle 76 #54-30',
        location: { type: 'Point', coordinates: [ALTO_PRADO.lng, ALTO_PRADO.lat] },
      });
    });

    it('el seguimiento solo abre con el token y no expone el teléfono', async () => {
      const created = createdSchema.parse((await post('/orders', order(), newKey())).json());
      const url = `/v1/public/la-parrilla-de-tono/orders/${created.number}`;

      const ok = await app.inject({ method: 'GET', url: `${url}?token=${created.trackingToken}` });
      const wrong = await app.inject({ method: 'GET', url: `${url}?token=otro` });

      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toMatchObject({
        number: created.number,
        status: 'received',
        fulfillment: 'delivery',
        totals: { subtotal: 36000, deliveryFee: 3000, total: 39000 },
        payment: { method: 'cash', cashTendered: 50000 },
        items: [{ name: 'Sencilla', modifiersLabel: 'Medio', qty: 2, total: 36000 }],
      });
      expect(ok.body).not.toContain('573001234567');
      expect(wrong.statusCode).toBe(404);
    });

    it('rechaza un celular que no es de Colombia', async () => {
      const response = await post(
        '/orders',
        order({ customer: { name: 'Ana', phone: '605 345 6789' } }),
        newKey(),
      );

      expect(response.statusCode).toBe(400);
      expect(errorSchema.parse(response.json()).error).toBe('invalid_phone');
    });

    it('exige la autorización de datos', async () => {
      const response = await post(
        '/orders',
        order({ consent: { service: false, marketing: false } }),
        newKey(),
      );

      expect(response.statusCode).toBe(400);
    });

    it('no acepta un efectivo que no alcanza', async () => {
      const response = await post(
        '/orders',
        order({ payment: { method: 'cash', cashTendered: 20000 } }),
        newKey(),
      );

      expect(errorSchema.parse(response.json())).toMatchObject({
        error: 'cash_short',
        message: 'Con eso no alcanza: el total es $39.000.',
      });
    });

    it('no crea pedidos por debajo del mínimo de la zona', async () => {
      const response = await post('/orders', order({ lines: [{ ...line, qty: 1 }] }), newKey());

      expect(response.statusCode).toBe(422);
      expect(errorSchema.parse(response.json()).message).toBe(
        'El pedido mínimo para domicilio a tu zona es $20.000. Te faltan $2.000.',
      );
    });

    it('exige la clave de idempotencia', async () => {
      const response = await post('/orders', order());

      expect(errorSchema.parse(response.json()).error).toBe('missing_idempotency_key');
    });

    it('con la sede en pausa no se puede pedir', async () => {
      const branches = app.get(BranchesRepository);

      await branches.updateOne(parrilla.tenantId, { _id: parrilla.branchId }, { status: 'paused' });

      const response = await post('/orders', order(), newKey());

      await branches.updateOne(parrilla.tenantId, { _id: parrilla.branchId }, { status: 'open' });

      expect(response.statusCode).toBe(422);
      expect(errorSchema.parse(response.json()).message).toMatch(
        /^No estamos recibiendo pedidos en este momento/,
      );
    });
  });
});
