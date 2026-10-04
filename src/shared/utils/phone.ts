/**
 * Celulares de Colombia.
 *
 * Se guardan en E.164 (`+573001234567`): es el formato que pide WhatsApp y el
 * único que deja comparar "300 123 4567" con "+57 300-123-4567". Solo se
 * aceptan celulares (empiezan por 3, 10 dígitos): por ahí llegan la
 * confirmación y el seguimiento del pedido.
 */
export function normalizeColombianMobile(raw: string): string | null {
  let digits = raw.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('57')) digits = digits.slice(2);

  if (!/^3\d{9}$/.test(digits)) return null;

  return `+57${digits}`;
}
