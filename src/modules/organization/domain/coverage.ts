/**
 * Cobertura de domicilios por anillos alrededor de la sede.
 *
 * Cada anillo dice hasta qué distancia llega, cuánto cuesta el domicilio y el
 * pedido mínimo. Es más fácil de configurar que dibujar polígonos, y alcanza
 * para el piloto; los polígonos (barrios) pueden venir después sin cambiar a
 * quien pregunta.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface DeliveryRing {
  /** Hasta dónde llega este anillo, en kilómetros en línea recta. */
  maxKm: number;
  fee: number;
  minOrder: number;
}

export type Coverage =
  | { covered: true; distanceKm: number; fee: number; minOrder: number }
  | { covered: false; distanceKm: number };

const EARTH_RADIUS_KM = 6371;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Distancia en línea recta (haversine), en kilómetros. */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = radians(to.lat - from.lat);
  const dLng = radians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** El anillo más cercano que alcanza el punto, o "no cubierto". */
export function coverageFor(
  branch: GeoPoint,
  rings: readonly DeliveryRing[],
  destination: GeoPoint,
): Coverage {
  const distance = Math.round(distanceKm(branch, destination) * 10) / 10;
  const ring = [...rings].sort((a, b) => a.maxKm - b.maxKm).find((r) => distance <= r.maxKm);

  if (!ring) return { covered: false, distanceKm: distance };

  return { covered: true, distanceKm: distance, fee: ring.fee, minOrder: ring.minOrder };
}
