import { z } from 'zod';

/**
 * El menú publicado de una sucursal: lo que lee la carta y contra lo que se
 * cotiza.
 *
 * Se guarda como un solo documento (ver `MenuSnapshot`) y se lee de vuelta
 * con estos esquemas: lo que sale de la base es `unknown` hasta que se
 * demuestre lo contrario, igual que lo que llega por la red.
 */

/**
 * Etiquetas que el restaurante le pone a un producto para destacarlo en la
 * carta. `popular` además lo sube al carrusel de "Lo más pedido".
 */
export const ITEM_TAGS = ['popular', 'new', 'spicy', 'vegetarian'] as const;

export type ItemTag = (typeof ITEM_TAGS)[number];

export const snapshotModifierSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceDelta: z.number().int(),
  available: z.boolean(),
});

export const snapshotGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  min: z.number().int().min(0),
  max: z.number().int().min(1),
  modifiers: z.array(snapshotModifierSchema),
});

export const snapshotItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().int().min(0),
  imageUrl: z.string().nullable(),
  available: z.boolean(),
  tags: z.array(z.enum(ITEM_TAGS)).default([]),
  groups: z.array(snapshotGroupSchema),
});

export const snapshotCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  items: z.array(snapshotItemSchema),
});

export const snapshotCategoriesSchema = z.array(snapshotCategorySchema);

export type SnapshotModifier = z.infer<typeof snapshotModifierSchema>;
export type SnapshotGroup = z.infer<typeof snapshotGroupSchema>;
export type SnapshotItem = z.infer<typeof snapshotItemSchema>;
export type SnapshotCategory = z.infer<typeof snapshotCategorySchema>;

export function findSnapshotItem(
  categories: readonly SnapshotCategory[],
  itemId: string,
): SnapshotItem | null {
  for (const category of categories) {
    const item = category.items.find((candidate) => candidate.id === itemId);

    if (item) return item;
  }

  return null;
}
