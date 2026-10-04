import type { SnapshotCategory } from './snapshot';

import { quoteLines } from './quote';

const termino = {
  id: 'termino',
  name: 'Término de la carne',
  min: 1,
  max: 1,
  modifiers: [
    { id: 'medio', name: 'Medio', priceDelta: 0, available: true },
    { id: 'tres-cuartos', name: 'Tres cuartos', priceDelta: 0, available: true },
  ],
};

const adiciones = {
  id: 'adiciones',
  name: 'Adiciones',
  min: 0,
  max: 2,
  modifiers: [
    { id: 'tocineta', name: 'Tocineta', priceDelta: 3000, available: true },
    { id: 'queso', name: 'Queso extra', priceDelta: 2500, available: true },
    { id: 'huevo', name: 'Huevo', priceDelta: 2000, available: false },
  ],
};

const acompanantes = {
  id: 'acompanantes',
  name: 'Acompañantes',
  min: 2,
  max: 2,
  modifiers: [
    { id: 'patacon', name: 'Patacón', priceDelta: 0, available: true },
    { id: 'yuca', name: 'Yuca', priceDelta: 0, available: true },
    { id: 'arroz', name: 'Arroz con coco', priceDelta: 2000, available: true },
  ],
};

const menu: SnapshotCategory[] = [
  {
    id: 'hamburguesas',
    name: 'Hamburguesas',
    items: [
      {
        id: 'sencilla',
        name: 'Sencilla',
        description: null,
        price: 18000,
        imageUrl: null,
        available: true,
        groups: [termino, adiciones],
      },
      {
        id: 'doble',
        name: 'Doble',
        description: null,
        price: 26000,
        imageUrl: null,
        available: false,
        groups: [termino],
      },
    ],
  },
  {
    id: 'asados',
    name: 'Asados',
    items: [
      {
        id: 'punta',
        name: 'Punta de anca',
        description: null,
        price: 38000,
        imageUrl: null,
        available: true,
        groups: [acompanantes],
      },
    ],
  },
];

describe('quoteLines', () => {
  it('cotiza con adiciones y cantidades', () => {
    const quote = quoteLines(menu, [
      { itemId: 'sencilla', modifierIds: ['medio', 'tocineta'], note: 'sin cebolla', qty: 2 },
      { itemId: 'punta', modifierIds: ['patacon', 'arroz'], note: '', qty: 1 },
    ]);

    expect(quote.rejected).toEqual([]);
    expect(quote.lines.map((line) => [line.index, line.unitPrice, line.total])).toEqual([
      [0, 21000, 42000],
      [1, 40000, 40000],
    ]);
    expect(quote.lines[0]?.modifiersLabel).toBe('Medio · Tocineta');
    expect(quote.subtotal).toBe(82000);
  });

  it('rechaza cada línea con su motivo y cotiza el resto', () => {
    const quote = quoteLines(menu, [
      { itemId: 'doble', modifierIds: ['medio'], note: '', qty: 1 },
      { itemId: 'sencilla', modifierIds: [], note: '', qty: 1 },
      { itemId: 'sencilla', modifierIds: ['medio', 'huevo'], note: '', qty: 1 },
      {
        itemId: 'sencilla',
        modifierIds: ['medio', 'tocineta', 'queso', 'huevo'],
        note: '',
        qty: 1,
      },
      { itemId: 'punta', modifierIds: ['patacon'], note: '', qty: 1 },
      { itemId: 'no-existe', modifierIds: [], note: '', qty: 1 },
      { itemId: 'sencilla', modifierIds: ['medio', 'medio'], note: '', qty: 1 },
      { itemId: 'sencilla', modifierIds: ['tres-cuartos'], note: '', qty: 1 },
    ]);

    expect(quote.rejected).toEqual([
      { index: 0, name: 'Doble', reason: '«Doble» se agotó.' },
      { index: 1, name: 'Sencilla', reason: 'Elige una opción en «Término de la carne».' },
      { index: 2, name: 'Sencilla', reason: '«Huevo» se agotó.' },
      { index: 3, name: 'Sencilla', reason: '«Huevo» se agotó.' },
      { index: 4, name: 'Punta de anca', reason: 'Elige al menos 2 en «Acompañantes».' },
      { index: 5, name: 'Producto', reason: 'Este producto ya no está en la carta.' },
      { index: 6, name: 'Sencilla', reason: 'Una opción de «Sencilla» viene repetida.' },
    ]);
    expect(quote.lines.map((line) => line.index)).toEqual([7]);
    expect(quote.subtotal).toBe(18000);
  });

  it('rechaza pasar del máximo de un grupo', () => {
    const quote = quoteLines(menu, [
      { itemId: 'punta', modifierIds: ['patacon', 'yuca', 'arroz'], note: '', qty: 1 },
    ]);

    expect(quote.rejected[0]?.reason).toBe('Elige máximo 2 en «Acompañantes».');
  });
});
