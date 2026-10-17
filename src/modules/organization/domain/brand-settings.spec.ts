import {
  FOREGROUND_DARK,
  FOREGROUND_LIGHT,
  isSafeColor,
  primaryForeground,
  relativeLuminance,
} from './brand-settings';

describe('isSafeColor', () => {
  it('acepta hex corto y largo', () => {
    expect(isSafeColor('#fff')).toBe(true);
    expect(isSafeColor('#c0392b')).toBe(true);
    expect(isSafeColor('#c0392bcc')).toBe(true);
  });

  it('acepta oklch numérico', () => {
    expect(isSafeColor('oklch(0.52 0.19 33)')).toBe(true);
    expect(isSafeColor('oklch(60% 0.2 33 / 50%)')).toBe(true);
  });

  it('rechaza lo que no es un color conocido', () => {
    expect(isSafeColor('red')).toBe(false);
    expect(isSafeColor('url(x)')).toBe(false);
    expect(isSafeColor('#ggg')).toBe(false);
    expect(isSafeColor('')).toBe(false);
  });
});

describe('relativeLuminance', () => {
  it('blanco es 1 y negro es 0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(relativeLuminance('#000000')).toBeCloseTo(0);
  });

  it('oklch acromático se parece a su hex', () => {
    expect(relativeLuminance('oklch(1 0 0)')).toBeCloseTo(1);
    expect(relativeLuminance('oklch(0.2 0 0)')).toBeCloseTo(relativeLuminance('#141414'), 1);
  });
});

describe('primaryForeground', () => {
  it('color oscuro pide texto blanco', () => {
    expect(primaryForeground('#000000')).toBe(FOREGROUND_LIGHT);
    expect(primaryForeground('oklch(0.2 0 0)')).toBe(FOREGROUND_LIGHT);
  });

  it('color claro pide texto casi negro', () => {
    expect(primaryForeground('#ffffff')).toBe(FOREGROUND_DARK);
    expect(primaryForeground('oklch(0.9 0 0)')).toBe(FOREGROUND_DARK);
  });

  it('un color inválido cuenta como negro y pide blanco', () => {
    expect(primaryForeground('no es un color')).toBe(FOREGROUND_LIGHT);
  });
});
