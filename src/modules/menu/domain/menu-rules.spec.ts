import { groupProblem, reorder } from './menu-rules';

const group = {
  name: 'Salsas',
  min: 0,
  max: 2,
  modifiers: [
    { name: 'Rosada', priceDelta: 0, available: true },
    { name: 'Piña', priceDelta: 0, available: true },
  ],
};

describe('groupProblem', () => {
  it('acepta un grupo coherente', () => {
    expect(groupProblem(group)).toBeNull();
  });

  it('explica cada problema en palabras', () => {
    expect(groupProblem({ ...group, modifiers: [] })).toBe(
      'El grupo necesita al menos una opción.',
    );
    expect(groupProblem({ ...group, min: 2, max: 1 })).toBe(
      'El mínimo no puede ser mayor que el máximo.',
    );
    expect(groupProblem({ ...group, max: 3 })).toBe(
      'No se pueden elegir 3 opciones si el grupo tiene 2.',
    );
    expect(
      groupProblem({
        ...group,
        modifiers: [...group.modifiers, { name: ' rosada ', priceDelta: 0, available: true }],
      }),
    ).toBe('Hay dos opciones con el mismo nombre.');
    expect(
      groupProblem({
        ...group,
        modifiers: [{ name: 'Rosada', priceDelta: 1500.5, available: true }],
        max: 1,
      }),
    ).toBe('Los precios van en pesos enteros, sin decimales.');
  });
});

describe('reorder', () => {
  it('pone primero lo pedido y conserva lo demás', () => {
    expect(reorder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignora ids desconocidos o repetidos', () => {
    expect(reorder(['a', 'b'], ['x', 'b', 'b'])).toEqual(['b', 'a']);
  });
});
