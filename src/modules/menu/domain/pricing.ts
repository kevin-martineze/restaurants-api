import type { SnapshotItem } from './snapshot';

/**
 * Reglas de precio y de elección de modificadores.
 *
 * Esta es la regla que vale: la cotización y la creación del pedido pasan por
 * aquí. El frontend tiene una copia en `$lib/domain/menu-selection.ts` solo
 * para guiar al cliente mientras elige; los mensajes son los mismos a
 * propósito, y si cambia uno hay que cambiar el otro.
 */

export function countInGroup(
  selection: readonly string[],
  group: SnapshotItem['groups'][number],
): number {
  return group.modifiers.filter((modifier) => selection.includes(modifier.id)).length;
}

/** Lo que impide pedir el producto con esta selección. Vacío si todo está bien. */
export function selectionProblems(item: SnapshotItem, selection: readonly string[]): string[] {
  const problems: string[] = [];

  if (!item.available) problems.push(`«${item.name}» se agotó.`);

  if (new Set(selection).size !== selection.length) {
    problems.push(`Una opción de «${item.name}» viene repetida.`);
  }

  const known = new Map(
    item.groups.flatMap((group) => group.modifiers.map((modifier) => [modifier.id, modifier])),
  );

  for (const id of selection) {
    const modifier = known.get(id);

    if (!modifier) {
      problems.push(`Una de las opciones de «${item.name}» ya no existe.`);
    } else if (!modifier.available) {
      problems.push(`«${modifier.name}» se agotó.`);
    }
  }

  for (const group of item.groups) {
    const count = countInGroup(selection, group);

    if (count < group.min) {
      problems.push(
        group.min === 1
          ? `Elige una opción en «${group.name}».`
          : `Elige al menos ${group.min} en «${group.name}».`,
      );
    } else if (count > group.max) {
      problems.push(`Elige máximo ${group.max} en «${group.name}».`);
    }
  }

  return problems;
}

/** Precio de una unidad: base más lo que suman las opciones elegidas. */
export function unitPrice(item: SnapshotItem, selection: readonly string[]): number {
  let total = item.price;

  for (const group of item.groups) {
    for (const modifier of group.modifiers) {
      if (selection.includes(modifier.id)) total += modifier.priceDelta;
    }
  }

  return total;
}

/** Las opciones elegidas en texto corto, en el orden de los grupos. */
export function selectionLabel(item: SnapshotItem, selection: readonly string[]): string {
  return item.groups
    .flatMap((group) => group.modifiers)
    .filter((modifier) => selection.includes(modifier.id))
    .map((modifier) => modifier.name)
    .join(' · ');
}
