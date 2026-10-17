import { findOverlappingSlots, sortRings } from './branch-settings';

describe('findOverlappingSlots', () => {
  it('dos turnos normales que no se pisan no chocan', () => {
    const schedule = [
      { day: 1, opens: '11:00', closes: '15:00' },
      { day: 1, opens: '18:00', closes: '22:00' },
    ];

    expect(findOverlappingSlots(schedule)).toBeNull();
  });

  it('detecta dos turnos del mismo día que se pisan', () => {
    const schedule = [
      { day: 1, opens: '11:00', closes: '16:00' },
      { day: 1, opens: '15:00', closes: '22:00' },
    ];

    expect(findOverlappingSlots(schedule)).not.toBeNull();
  });

  it('el que cruza la medianoche no choca con uno de la mañana', () => {
    const schedule = [
      { day: 1, opens: '18:00', closes: '02:00' },
      { day: 1, opens: '08:00', closes: '12:00' },
    ];

    expect(findOverlappingSlots(schedule)).toBeNull();
  });

  it('un turno de 24 horas choca con cualquiera', () => {
    const schedule = [
      { day: 1, opens: '00:00', closes: '00:00' },
      { day: 1, opens: '12:00', closes: '14:00' },
    ];

    expect(findOverlappingSlots(schedule)).not.toBeNull();
  });

  it('días distintos no se comparan entre sí', () => {
    const schedule = [
      { day: 1, opens: '11:00', closes: '16:00' },
      { day: 2, opens: '15:00', closes: '22:00' },
    ];

    expect(findOverlappingSlots(schedule)).toBeNull();
  });
});

describe('sortRings', () => {
  it('ordena de menor a mayor distancia', () => {
    expect(
      sortRings([
        { maxKm: 6, fee: 5000, minOrder: 30000 },
        { maxKm: 3, fee: 3000, minOrder: 20000 },
      ]),
    ).toEqual([
      { maxKm: 3, fee: 3000, minOrder: 20000 },
      { maxKm: 6, fee: 5000, minOrder: 30000 },
    ]);
  });

  it('dos anillos con la misma distancia son ambiguos', () => {
    expect(
      sortRings([
        { maxKm: 3, fee: 3000, minOrder: 20000 },
        { maxKm: 3, fee: 4000, minOrder: 25000 },
      ]),
    ).toBeNull();
  });
});
