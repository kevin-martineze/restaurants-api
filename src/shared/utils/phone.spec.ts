import { normalizeColombianMobile } from './phone';

describe('normalizeColombianMobile', () => {
  it('lleva cualquier escritura de un celular a E.164', () => {
    expect(normalizeColombianMobile('300 123 4567')).toBe('+573001234567');
    expect(normalizeColombianMobile('+57 300-123-4567')).toBe('+573001234567');
    expect(normalizeColombianMobile('573001234567')).toBe('+573001234567');
  });

  it('rechaza lo que no es un celular colombiano', () => {
    expect(normalizeColombianMobile('6053456789')).toBeNull();
    expect(normalizeColombianMobile('30012345')).toBeNull();
    expect(normalizeColombianMobile('')).toBeNull();
  });
});
