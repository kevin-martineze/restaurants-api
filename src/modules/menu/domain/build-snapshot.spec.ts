import type { SnapshotSource, SourceItem } from './build-snapshot';

import { buildSnapshot } from './build-snapshot';

const salsas = {
  id: 'salsas',
  name: 'Salsas',
  min: 0,
  max: 2,
  modifiers: [{ id: 'rosada', name: 'Rosada', priceDelta: 0, available: true }],
};

const preparacion = {
  id: 'preparacion',
  name: 'Preparación',
  min: 1,
  max: 1,
  modifiers: [{ id: 'agua', name: 'En agua', priceDelta: 0, available: true }],
};

function item(id: string, categoryId: string, extra: Partial<SourceItem> = {}): SourceItem {
  return {
    id,
    categoryId,
    name: id,
    description: null,
    price: 1000,
    imageUrl: null,
    available: true,
    position: 1,
    modifierGroupIds: [],
    tags: [],
    pairsWith: [],
    ...extra,
  };
}

function source(overrides: Partial<SnapshotSource> = {}): SnapshotSource {
  return {
    categories: [
      { id: 'bebidas', name: 'Bebidas', position: 3, active: true, role: 'drink' },
      { id: 'hamburguesas', name: 'Hamburguesas', position: 1, active: true, role: 'main' },
      { id: 'acompanantes', name: 'Acompañantes', position: 2, active: true, role: 'side' },
      { id: 'temporada', name: 'Temporada', position: 4, active: false, role: 'main' },
      { id: 'vacia', name: 'Vacía', position: 5, active: true, role: 'main' },
    ],
    items: [
      item('doble', 'hamburguesas', {
        position: 2,
        modifierGroupIds: ['salsas', 'borrado'],
        tags: ['popular'],
      }),
      item('sencilla', 'hamburguesas', { position: 1 }),
      item('agua', 'bebidas', { position: 1, available: false }),
      item('kola', 'bebidas', { position: 2 }),
      item('jugo', 'bebidas', { position: 3, modifierGroupIds: ['preparacion'] }),
      item('cerveza', 'bebidas', { position: 4 }),
      item('yuca', 'acompanantes', { position: 1 }),
      item('patacon', 'acompanantes', { position: 2, tags: ['popular'] }),
      item('mango', 'temporada'),
    ],
    groups: [salsas, preparacion],
    overrides: [],
    ...overrides,
  };
}

function suggestionsOf(snapshot: ReturnType<typeof buildSnapshot>, id: string) {
  return snapshot.flatMap((category) => category.items).find((i) => i.id === id)?.suggestedItemIds;
}

describe('buildSnapshot', () => {
  it('ordena categorías y productos, y omite las inactivas o vacías', () => {
    const snapshot = buildSnapshot(source());

    expect(snapshot.map((category) => category.id)).toEqual([
      'hamburguesas',
      'acompanantes',
      'bebidas',
    ]);
    expect(snapshot[0]?.items.map((i) => i.id)).toEqual(['sencilla', 'doble']);
  });

  it('resuelve los grupos en orden, ignora los que ya no existen y conserva las etiquetas', () => {
    const doble = buildSnapshot(source())[0]?.items[1];

    expect(doble?.groups.map((group) => group.id)).toEqual(['salsas']);
    expect(doble?.tags).toEqual(['popular']);
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
    const [hamburguesas] = snapshot;
    const agua = snapshot.flatMap((category) => category.items).find((i) => i.id === 'agua');

    expect(hamburguesas?.items[0]?.price).toBe(19000);
    expect(hamburguesas?.items[1]?.available).toBe(false);
    // Apagado en la marca: la sucursal no lo puede prender.
    expect(agua?.available).toBe(false);
  });

  describe('Combina con…', () => {
    it('a un plato principal le sugiere acompañante y bebida intercalados, populares primero', () => {
      // patacón (popular) · kola · yuca. El agua está agotada y el jugo pide
      // elegir preparación: no se agregan con un toque.
      expect(suggestionsOf(buildSnapshot(source()), 'sencilla')).toEqual([
        'patacon',
        'kola',
        'yuca',
      ]);
    });

    it('los acompañantes y bebidas no llevan sugerencias automáticas', () => {
      const snapshot = buildSnapshot(source());

      expect(suggestionsOf(snapshot, 'patacon')).toEqual([]);
      expect(suggestionsOf(snapshot, 'kola')).toEqual([]);
    });

    it('las elegidas a mano mandan, en su orden, si se pueden agregar con un toque', () => {
      const base = source();
      const snapshot = buildSnapshot({
        ...base,
        items: base.items.map((i) =>
          i.id === 'doble' ? { ...i, pairsWith: ['cerveza', 'jugo', 'agua', 'yuca'] } : i,
        ),
      });

      expect(suggestionsOf(snapshot, 'doble')).toEqual(['cerveza', 'yuca']);
    });
  });
});
