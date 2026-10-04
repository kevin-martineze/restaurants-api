import type { SnapshotSource } from './build-snapshot';

import { buildSnapshot } from './build-snapshot';

const salsas = {
  id: 'salsas',
  name: 'Salsas',
  min: 0,
  max: 2,
  modifiers: [{ id: 'rosada', name: 'Rosada', priceDelta: 0, available: true }],
};

function source(overrides: Partial<SnapshotSource> = {}): SnapshotSource {
  return {
    categories: [
      { id: 'bebidas', name: 'Bebidas', position: 2, active: true },
      { id: 'hamburguesas', name: 'Hamburguesas', position: 1, active: true },
      { id: 'temporada', name: 'Temporada', position: 3, active: false },
      { id: 'vacia', name: 'Vacía', position: 4, active: true },
    ],
    items: [
      {
        id: 'doble',
        categoryId: 'hamburguesas',
        name: 'Doble',
        description: null,
        price: 26000,
        imageUrl: null,
        available: true,
        position: 2,
        modifierGroupIds: ['salsas', 'borrado'],
      },
      {
        id: 'sencilla',
        categoryId: 'hamburguesas',
        name: 'Sencilla',
        description: null,
        price: 18000,
        imageUrl: null,
        available: true,
        position: 1,
        modifierGroupIds: [],
      },
      {
        id: 'agua',
        categoryId: 'bebidas',
        name: 'Agua',
        description: null,
        price: 3000,
        imageUrl: null,
        available: false,
        position: 1,
        modifierGroupIds: [],
      },
      {
        id: 'mango',
        categoryId: 'temporada',
        name: 'Jugo de mango',
        description: null,
        price: 6000,
        imageUrl: null,
        available: true,
        position: 1,
        modifierGroupIds: [],
      },
    ],
    groups: [salsas],
    overrides: [],
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('ordena categorías y productos, y omite las inactivas o vacías', () => {
    const snapshot = buildSnapshot(source());

    expect(snapshot.map((category) => category.id)).toEqual(['hamburguesas', 'bebidas']);
    expect(snapshot[0]?.items.map((item) => item.id)).toEqual(['sencilla', 'doble']);
  });

  it('resuelve los grupos en orden e ignora los que ya no existen', () => {
    const doble = buildSnapshot(source())[0]?.items[1];

    expect(doble?.groups.map((group) => group.id)).toEqual(['salsas']);
  });

  it('aplica el precio y el agotado de la sucursal', () => {
    const snapshot = buildSnapshot(
      source({
        overrides: [
          { itemId: 'sencilla', price: 19000, available: null },
          { itemId: 'doble', price: null, available: false },
          { itemId: 'agua', price: null, available: true },
        ],
      }),
    );
    const [hamburguesas, bebidas] = snapshot;

    expect(hamburguesas?.items[0]?.price).toBe(19000);
    expect(hamburguesas?.items[1]?.available).toBe(false);
    // Apagado en la marca: la sucursal no lo puede prender.
    expect(bebidas?.items[0]?.available).toBe(false);
  });
});
