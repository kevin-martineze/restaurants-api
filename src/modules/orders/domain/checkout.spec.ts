import type { CheckoutContext } from './checkout';

import { evaluateCheckout } from './checkout';

const line = {
  index: 0,
  itemId: 'sencilla',
  modifierIds: [],
  modifiers: [],
  name: 'Sencilla',
  modifiersLabel: '',
  note: '',
  qty: 2,
  unitPrice: 18000,
  total: 36000,
};

function context(overrides: Partial<CheckoutContext> = {}): CheckoutContext {
  return {
    quote: { lines: [line], rejected: [], subtotal: 36000 },
    status: { open: true, label: 'Abierto · cierra a las 11:00 p. m.' },
    fulfillment: 'delivery',
    offered: ['delivery', 'pickup'],
    branchDelivers: true,
    coverage: { covered: true, distanceKm: 1.2, fee: 3000, minOrder: 20000 },
    ...overrides,
  };
}

describe('evaluateCheckout', () => {
  it('suma el domicilio de la zona', () => {
    expect(evaluateCheckout(context())).toEqual({
      blockers: [],
      subtotal: 36000,
      deliveryFee: 3000,
      total: 39000,
      minOrder: 20000,
      distanceKm: 1.2,
    });
  });

  it('para recoger no cobra domicilio ni pide ubicación', () => {
    const result = evaluateCheckout(context({ fulfillment: 'pickup', coverage: null }));

    expect(result).toMatchObject({ blockers: [], deliveryFee: 0, total: 36000 });
  });

  it('pide marcar el punto en el mapa', () => {
    expect(evaluateCheckout(context({ coverage: null })).blockers).toEqual([
      'Marca en el mapa dónde te entregamos.',
    ]);
  });

  it('dice hasta dónde no llegamos', () => {
    expect(
      evaluateCheckout(context({ coverage: { covered: false, distanceKm: 12.4 } })).blockers,
    ).toEqual(['Todavía no llegamos hasta allá (estás a 12.4 km). Puedes pedir para recoger.']);
  });

  it('dice cuánto falta para el pedido mínimo', () => {
    const result = evaluateCheckout(
      context({ coverage: { covered: true, distanceKm: 5, fee: 5000, minOrder: 40000 } }),
    );

    expect(result.blockers).toEqual([
      'El pedido mínimo para domicilio a tu zona es $40.000. Te faltan $4.000.',
    ]);
  });

  it('no deja pedir con el local cerrado, un carrito vacío o productos rechazados', () => {
    const result = evaluateCheckout(
      context({
        quote: {
          lines: [],
          rejected: [{ index: 0, name: 'Doble', reason: '«Doble» se agotó.' }],
          subtotal: 0,
        },
        status: { open: false, label: 'Cerrado · abre hoy a las 12:00 p. m.' },
      }),
    );

    expect(result.blockers.slice(0, 2)).toEqual([
      'Hay productos que no podemos preparar. Ajústalos para continuar.',
      'No estamos recibiendo pedidos en este momento. Cerrado · abre hoy a las 12:00 p. m.',
    ]);
  });

  it('respeta lo que ofrece la sede', () => {
    expect(evaluateCheckout(context({ offered: ['pickup'] })).blockers).toEqual([
      'Esta sede no hace domicilios. Puedes pedir para recoger.',
    ]);
    expect(
      evaluateCheckout(context({ fulfillment: 'pickup', offered: ['delivery'], coverage: null }))
        .blockers,
    ).toEqual(['Esta sede no tiene recogida en tienda.']);
  });
});
