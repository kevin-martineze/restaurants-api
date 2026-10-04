import { formatTime, openStatus, ScheduleSlot } from './schedule';

/** Una fecha a una hora de Colombia (UTC−5). 2026-10-05 es lunes. */
function bogota(isoLocal: string): Date {
  return new Date(`${isoLocal}-05:00`);
}

const weekdays: ScheduleSlot[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  opens: '12:00',
  closes: '22:00',
}));

describe('formatTime', () => {
  it('escribe la hora como en Colombia', () => {
    expect(formatTime('12:00')).toBe('12:00 p. m.');
    expect(formatTime('00:30')).toBe('12:30 a. m.');
    expect(formatTime('09:05')).toBe('9:05 a. m.');
    expect(formatTime('23:00')).toBe('11:00 p. m.');
  });
});

describe('openStatus', () => {
  it('abierto dentro del turno', () => {
    expect(openStatus(weekdays, bogota('2026-10-05T13:00:00'))).toEqual({
      open: true,
      label: 'Abierto · cierra a las 10:00 p. m.',
    });
  });

  it('usa la hora de Colombia aunque el servidor esté en otra zona', () => {
    // 03:00 UTC del martes son las 10:00 p. m. del lunes en Colombia: ya cerró.
    expect(openStatus(weekdays, new Date('2026-10-06T03:00:00Z')).open).toBe(false);
  });

  it('antes de abrir dice a qué hora abre hoy', () => {
    expect(openStatus(weekdays, bogota('2026-10-05T09:00:00'))).toEqual({
      open: false,
      label: 'Cerrado · abre hoy a las 12:00 p. m.',
    });
  });

  it('después de cerrar dice que abre mañana', () => {
    expect(openStatus(weekdays, bogota('2026-10-05T22:30:00')).label).toBe(
      'Cerrado · abre mañana a las 12:00 p. m.',
    );
  });

  it('el viernes en la noche apunta al lunes', () => {
    expect(openStatus(weekdays, bogota('2026-10-09T23:00:00')).label).toBe(
      'Cerrado · abre el lunes a las 12:00 p. m.',
    );
  });

  it('un turno que cruza la medianoche sigue abierto de madrugada', () => {
    const night: ScheduleSlot[] = [{ day: 5, opens: '18:00', closes: '02:00' }];

    expect(openStatus(night, bogota('2026-10-09T20:00:00')).open).toBe(true);
    expect(openStatus(night, bogota('2026-10-10T01:30:00')).open).toBe(true);
    expect(openStatus(night, bogota('2026-10-10T02:30:00')).open).toBe(false);
  });

  it('sin horario queda cerrado', () => {
    expect(openStatus([], bogota('2026-10-05T13:00:00'))).toEqual({
      open: false,
      label: 'Cerrado por ahora',
    });
  });
});
