import type { SnapshotCategory, SnapshotGroup } from './snapshot';

/**
 * Entradas del armado, ya leídas de la base. Los ids van como texto: el menú
 * publicado no conoce ObjectId.
 */
export interface SourceCategory {
  id: string;
  name: string;
  position: number;
  active: boolean;
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

/**
 * Arma el menú publicado de una sucursal.
 *
 * - Categorías activas en su orden; las que quedan sin productos no salen.
 * - El precio y el agotado de la sucursal pisan los de la marca. Un producto
 *   apagado en la marca sigue apagado aunque la sucursal no diga nada.
 * - Los grupos salen en el orden en que el producto los referencia.
 */
export function buildSnapshot(source: SnapshotSource): SnapshotCategory[] {
  const groups = new Map(source.groups.map((group) => [group.id, group]));
  const overrides = new Map(source.overrides.map((override) => [override.itemId, override]));

  return [...source.categories]
    .filter((category) => category.active)
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      id: category.id,
      name: category.name,
      items: source.items
        .filter((item) => item.categoryId === category.id)
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const override = overrides.get(item.id);

          return {
            id: item.id,
            name: item.name,
            description: item.description,
            price: override?.price ?? item.price,
            imageUrl: item.imageUrl,
            available: item.available && override?.available !== false,
            groups: item.modifierGroupIds.flatMap((groupId) => {
              const group = groups.get(groupId);

              return group ? [group] : [];
            }),
          };
        }),
    }))
    .filter((category) => category.items.length > 0);
}
