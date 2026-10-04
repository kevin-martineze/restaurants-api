import { randomBytes } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * La foto de un producto: un solo tamaño, 800 px de ancho en WebP. Alcanza
 * para la galería en dos columnas y para la hoja del producto en pantallas de
 * alta densidad, y pesa una fracción de la original del celular.
 */
export const PRODUCT_IMAGE = { width: 800, quality: 78 };

/**
 * Convierte la foto original. `rotate()` aplica la orientación EXIF (sin eso,
 * una foto vertical del celular se ve acostada) y `withoutEnlargement` deja
 * una foto pequeña en su tamaño en vez de inventarle píxeles.
 */
export async function processProductImage(original: Buffer): Promise<Buffer> {
  try {
    await sharp(original).metadata();
  } catch {
    throw new BadRequestException({
      error: 'invalid_upload',
      message: 'El archivo no es una imagen.',
    });
  }

  return sharp(original)
    .rotate()
    .resize({ width: PRODUCT_IMAGE.width, withoutEnlargement: true })
    .webp({ quality: PRODUCT_IMAGE.quality })
    .toBuffer();
}

/**
 * Clave de una foto nueva. Empieza por el tenant para que un bucket compartido
 * quede ordenado por restaurante, y la marca de tiempo hace que una clave no
 * se reutilice nunca: el caché puede ser inmutable.
 */
export function productImageKey(tenantId: string, itemId: string): string {
  const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

  return `tenants/${tenantId}/items/${itemId}/${stamp}.webp`;
}
