import { slugify, slugProblem } from './slug';

describe('slugify', () => {
  it('quita tildes, eñes y signos', () => {
    expect(slugify('La Parrilla de Toño')).toBe('la-parrilla-de-tono');
    expect(slugify('  Asados & Más!! ')).toBe('asados-mas');
  });
});

describe('slugProblem', () => {
  it('acepta un slug válido', () => {
    expect(slugProblem('la-parrilla-de-tono')).toBeNull();
  });

  it('rechaza rutas reservadas del equipo', () => {
    expect(slugProblem('panel')).toBe('Ese enlace está reservado. Elige otro.');
  });

  it('rechaza formatos inválidos', () => {
    expect(slugProblem('ab')).not.toBeNull();
    expect(slugProblem('Con-Mayusculas')).not.toBeNull();
    expect(slugProblem('doble--guion')).not.toBeNull();
  });
});
