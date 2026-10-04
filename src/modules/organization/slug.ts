/**
 * Slug público de una marca: la carta vive en `/{slug}` del frontend.
 *
 * Las rutas del equipo comparten espacio con las cartas, así que sus nombres
 * quedan reservados. Si el frontend agrega una ruta de primer nivel, se agrega
 * aquí también.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'account',
  'admin',
  'api',
  'dashboard',
  'help',
  'kitchen',
  'login',
  'logout',
  'platform',
  'privacy',
  'rider',
  'settings',
  'signup',
  'terms',
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 48;

/** Por qué un slug no sirve, o null si sirve. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN_LENGTH || slug.length > SLUG_MAX_LENGTH) {
    return `El enlace debe tener entre ${SLUG_MIN_LENGTH} y ${SLUG_MAX_LENGTH} caracteres.`;
  }

  if (!SLUG_PATTERN.test(slug)) {
    return 'El enlace solo puede tener letras minúsculas sin tildes, números y guiones.';
  }

  if (RESERVED_SLUGS.has(slug)) return 'Ese enlace está reservado. Elige otro.';

  return null;
}

/** "La Parrilla de Toño" → "la-parrilla-de-tono". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}
