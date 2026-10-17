import { randomBytes } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

/**
 * La foto de un producto: un solo tamaño, 800 px de ancho en WebP. Alcanza
 * para la galería en dos columnas y para la hoja del producto en pantallas de
 * alta densidad, y pesa una fracción de la original del celular.
 */
export const PRODUCT_IMAGE = { width: 800, quality: 78 };

/** El logo de la marca: un cuadrado de 512 px. */
export const LOGO_IMAGE = { size: 512, quality: 82 };

/** La portada de la carta: 1600 px de ancho, para pantallas de alta densidad. */
export const COVER_IMAGE = { width: 1600, quality: 78 };

async function assertImage(original: Buffer): Promise<void> {
  try {
    await sharp(original).metadata();
  } catch {
    throw new BadRequestException({
      error: 'invalid_upload',
      message: 'El archivo no es una imagen.',
    });
  }
}

/**
 * Convierte la foto original. `rotate()` aplica la orientación EXIF (sin eso,
 * una foto vertical del celular se ve acostada) y `withoutEnlargement` deja
 * una foto pequeña en su tamaño en vez de inventarle píxeles.
 */
export async function processProductImage(original: Buffer): Promise<Buffer> {
  await assertImage(original);

  return sharp(original)
    .rotate()
    .resize({ width: PRODUCT_IMAGE.width, withoutEnlargement: true })
    .webp({ quality: PRODUCT_IMAGE.quality })
    .toBuffer();
}

/** El logo a 512 px en WebP, recortado al centro para que quede cuadrado. */
export async function processLogoImage(original: Buffer): Promise<Buffer> {
  await assertImage(original);

  return sharp(original)
    .rotate()
    .resize(LOGO_IMAGE.size, LOGO_IMAGE.size, { fit: 'cover' })
    .webp({ quality: LOGO_IMAGE.quality })
    .toBuffer();
}

/** La portada a 1600 px de ancho en WebP, sin agrandar una imagen pequeña. */
export async function processCoverImage(original: Buffer): Promise<Buffer> {
  await assertImage(original);

  return sharp(original)
    .rotate()
    .resize({ width: COVER_IMAGE.width, withoutEnlargement: true })
    .webp({ quality: COVER_IMAGE.quality })
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

/** Clave de un logo o una portada de marca, con la misma idea de la foto. */
export function brandImageKey(tenantId: string, brandId: string, kind: 'logo' | 'cover'): string {
  const stamp = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;

  return `tenants/${tenantId}/brands/${brandId}/${kind}/${stamp}.webp`;
}
