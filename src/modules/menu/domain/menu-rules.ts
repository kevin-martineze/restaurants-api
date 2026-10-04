/**
 * Reglas al editar la carta desde el panel. Puras: el servicio las aplica antes
 * de escribir, porque `updateOne` no corre las validaciones del esquema.
 */

export interface GroupInput {
  name: string;
  min: number;
  max: number;
  modifiers: { name: string; priceDelta: number; available: boolean }[];
}

/** Por qué un grupo de opciones no sirve, o null si sirve. */
export function groupProblem(group: GroupInput): string | null {
  if (group.modifiers.length === 0) return 'El grupo necesita al menos una opción.';

  if (group.min > group.max) return 'El mínimo no puede ser mayor que el máximo.';

  if (group.max > group.modifiers.length) {
    return `No se pueden elegir ${group.max} opciones si el grupo tiene ${group.modifiers.length}.`;
  }

  const names = group.modifiers.map((modifier) => modifier.name.trim().toLowerCase());

  if (new Set(names).size !== names.length) return 'Hay dos opciones con el mismo nombre.';

  if (group.modifiers.some((modifier) => !Number.isInteger(modifier.priceDelta))) {
    return 'Los precios van en pesos enteros, sin decimales.';
  }

  return null;
}

/**
 * Nuevo orden de una lista: los ids recibidos van primero, en ese orden; los
 * que no vinieron conservan su orden relativo al final. Así un panel con datos
 * viejos no pierde elementos al reordenar.
 */
export function reorder(currentIds: readonly string[], requested: readonly string[]): string[] {
  const known = new Set(currentIds);
  const head = requested.filter((id, index) => known.has(id) && requested.indexOf(id) === index);
  const rest = currentIds.filter((id) => !head.includes(id));

  return [...head, ...rest];
}
