export interface OpenStatus {
  open: boolean;
  /** Texto listo para mostrar: "Abierto · cierra a las 11:00 p. m.". */
  label: string;
}

/**
 * Horario de una sucursal y si está abierta ahora.
 *
 * Las horas son de Colombia (`America/Bogota`, UTC−5 todo el año, sin horario
 * de verano), sin importar dónde corra el servidor.
 */

export interface ScheduleSlot {
  /** 0 = domingo … 6 = sábado. */
  day: number;
  /** "HH:MM" en 24 horas. */
  opens: string;
  /** "HH:MM". Si es menor o igual que `opens`, cierra al día siguiente (18:00 → 02:00). */
  closes: string;
}

const TIME_ZONE = 'America/Bogota';
const MINUTES_PER_DAY = 24 * 60;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const localParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Día de la semana y minuto del día en Colombia. */
function localNow(now: Date): { day: number; minute: number } {
  let day = 0;
  let hour = 0;
  let minute = 0;

  for (const part of localParts.formatToParts(now)) {
    if (part.type === 'weekday') day = WEEKDAY_INDEX[part.value] ?? 0;
    if (part.type === 'hour') hour = Number(part.value);
    if (part.type === 'minute') minute = Number(part.value);
  }

  return { day, minute: hour * 60 + minute };
}

function toMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
}

/** "12:00 p. m.", "9:30 a. m.": como se escribe la hora en Colombia. */
export function formatTime(time: string): string {
  const total = toMinutes(time) % MINUTES_PER_DAY;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const suffix = hours < 12 ? 'a. m.' : 'p. m.';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;

  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function isOvernight(slot: ScheduleSlot): boolean {
  return toMinutes(slot.closes) <= toMinutes(slot.opens);
}

/** El turno abierto en este momento, si hay alguno. */
function currentSlot(
  schedule: readonly ScheduleSlot[],
  day: number,
  minute: number,
): ScheduleSlot | null {
  const yesterday = (day + 6) % 7;

  for (const slot of schedule) {
    const opens = toMinutes(slot.opens);
    const closes = toMinutes(slot.closes);

    if (slot.day === day) {
      if (isOvernight(slot) ? minute >= opens : minute >= opens && minute < closes) return slot;
    }

    // Turno de anoche que sigue abierto pasada la medianoche.
    if (slot.day === yesterday && isOvernight(slot) && minute < closes) return slot;
  }

  return null;
}

export function openStatus(schedule: readonly ScheduleSlot[], now: Date): OpenStatus {
  const { day, minute } = localNow(now);
  const open = currentSlot(schedule, day, minute);

  if (open) {
    // Abre y cierra a la misma hora: turno de 24 horas, no "cierra a las 12:00 a. m.".
    if (toMinutes(open.opens) === toMinutes(open.closes)) {
      return { open: true, label: 'Abierto las 24 horas' };
    }

    return { open: true, label: `Abierto · cierra a las ${formatTime(open.closes)}` };
  }

  for (let offset = 0; offset < 7; offset += 1) {
    const candidateDay = (day + offset) % 7;
    const next = schedule
      .filter((slot) => slot.day === candidateDay)
      .filter((slot) => offset > 0 || toMinutes(slot.opens) > minute)
      .sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens))
      .at(0);

    if (!next) continue;

    const when =
      offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : `el ${WEEKDAYS[candidateDay] ?? ''}`;

    return { open: false, label: `Cerrado · abre ${when} a las ${formatTime(next.opens)}` };
  }

  return { open: false, label: 'Cerrado por ahora' };
}
