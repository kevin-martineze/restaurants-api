import type {
  CategoryRole,
  ItemTag,
  SnapshotCategory,
  SnapshotGroup,
  SnapshotItem,
} from './snapshot';

/**
 * Entradas del armado, ya leídas de la base. Los ids van como texto: el menú
 * publicado no conoce ObjectId.
 */
export interface SourceCategory {
  id: string;
  name: string;
  position: number;
  active: boolean;
  role: CategoryRole;
}

export interface SourceItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  position: number;
  modifierGroupIds: string[];
  tags: ItemTag[];
  /** Sugerencias elegidas a mano por el restaurante. Mandan sobre las automáticas. */
  pairsWith: string[];
}

export interface SourceOverride {
  itemId: string;
  price: number | null;
  available: boolean | null;
}

export interface SnapshotSource {
  categories: SourceCategory[];
  items: SourceItem[];
  groups: SnapshotGroup[];
  /** Cambios de la sucursal sobre los productos de la marca. */
  overrides: SourceOverride[];
}

/** Cuántas sugerencias como máximo por producto: más ya es ruido. */
export const MAX_SUGGESTIONS = 3;

/**
 * Arma el menú publicado de una sucursal.
 *
 * - Categorías activas en su orden; las que quedan sin productos no salen.
 * - El precio y el agotado de la sucursal pisan los de la marca. Un producto
 *   apagado en la marca sigue apagado aunque la sucursal no diga nada.
 * - Los grupos salen en el orden en que el producto los referencia.
 * - Cada producto lleva sus sugerencias de "Combina con…" (ver `suggestionsFor`).
 */
export function buildSnapshot(source: SnapshotSource): SnapshotCategory[] {
  const groups = new Map(source.groups.map((group) => [group.id, group]));
  const overrides = new Map(source.overrides.map((override) => [override.itemId, override]));

  const categories = [...source.categories]
    .filter((category) => category.active)
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      id: category.id,
      name: category.name,
      items: source.items
        .filter((item) => item.categoryId === category.id)
        .sort((a, b) => a.position - b.position)
        .map((item): SnapshotItem => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: overrides.get(item.id)?.price ?? item.price,
          imageUrl: item.imageUrl,
          available: item.available && overrides.get(item.id)?.available !== false,
          tags: item.tags,
          groups: item.modifierGroupIds.flatMap((groupId) => {
            const group = groups.get(groupId);

            return group ? [group] : [];
          }),
          suggestedItemIds: [],
        })),
    }))
    .filter((category) => category.items.length > 0);

  const suggestions = suggestionsFor(categories, source);

  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => ({
      ...item,
      suggestedItemIds: suggestions.get(item.id) ?? [],
    })),
  }));
}

/** Se agrega con un toque: disponible y sin opciones obligatorias. */
function isQuickAdd(item: SnapshotItem): boolean {
  return item.available && item.groups.every((group) => group.min === 0);
}

/** Intercala dos listas: a, b, a, b… Así salen un acompañante y una bebida. */
function interleave<T>(first: T[], second: T[]): T[] {
  const result: T[] = [];

  for (let index = 0; index < Math.max(first.length, second.length); index += 1) {
    const a = first[index];
    const b = second[index];

    if (a !== undefined) result.push(a);
    if (b !== undefined) result.push(b);
  }

  return result;
}

/**
 * "Combina con…" de cada producto.
 *
 * - Si el restaurante eligió a mano (`pairsWith`), van esas, en su orden.
 * - Si no, a un plato principal se le sugieren acompañantes y bebidas
 *   intercalados, con los más pedidos primero.
 * - Los acompañantes, bebidas y postres no llevan sugerencias automáticas.
 * - Solo entra lo que se agrega con un toque, y nunca el producto mismo.
 */
function suggestionsFor(
  categories: SnapshotCategory[],
  source: SnapshotSource,
): Map<string, string[]> {
  const roles = new Map(source.categories.map((category) => [category.id, category.role]));
  const published = new Map(
    categories.flatMap((category) =>
      category.items.map((item) => [item.id, { item, role: roles.get(category.id) ?? 'main' }]),
    ),
  );
  const quick = (role: CategoryRole): string[] =>
    categories
      .filter((category) => roles.get(category.id) === role)
      .flatMap((category) => category.items)
      .filter(isQuickAdd)
      .sort((a, b) => Number(b.tags.includes('popular')) - Number(a.tags.includes('popular')))
      .map((item) => item.id);
  const automatic = interleave(quick('side'), quick('drink'));

  const result = new Map<string, string[]>();

  for (const sourceItem of source.items) {
    const entry = published.get(sourceItem.id);

    if (!entry) continue;

    const manual = sourceItem.pairsWith.filter((id) => {
      const candidate = published.get(id)?.item;

      return candidate !== undefined && isQuickAdd(candidate);
    });
    const candidates = manual.length > 0 ? manual : entry.role === 'main' ? automatic : [];

    result.set(
      sourceItem.id,
      candidates.filter((id) => id !== sourceItem.id).slice(0, MAX_SUGGESTIONS),
    );
  }

  return result;
}
