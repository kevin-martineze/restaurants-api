import { coverageFor, distanceKm } from './coverage';

// Sede en El Prado y dos puntos de Barranquilla (coordenadas aproximadas).
const sede = { lat: 10.9965, lng: -74.8066 };
const altoPrado = { lat: 11.0035, lng: -74.8155 };
const soledad = { lat: 10.9184, lng: -74.7646 };

const rings = [
  { maxKm: 6, fee: 5000, minOrder: 30000 },
  { maxKm: 3, fee: 3000, minOrder: 20000 },
];

describe('distanceKm', () => {
  it('mide en línea recta', () => {
    expect(distanceKm(sede, sede)).toBe(0);
    expect(distanceKm(sede, altoPrado)).toBeCloseTo(1.24, 1);
  });
});

describe('coverageFor', () => {
  it('usa el anillo más cercano que alcanza el punto', () => {
    expect(coverageFor(sede, rings, altoPrado)).toEqual({
      covered: true,
      distanceKm: 1.2,
      fee: 3000,
      minOrder: 20000,
    });
  });

  it('fuera de todos los anillos no hay cobertura', () => {
    const result = coverageFor(sede, rings, soledad);

    expect(result.covered).toBe(false);
    expect(result.distanceKm).toBeGreaterThan(6);
  });

  it('sin anillos no hay domicilio', () => {
    expect(coverageFor(sede, [], altoPrado).covered).toBe(false);
  });
});
