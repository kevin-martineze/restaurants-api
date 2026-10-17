import { ScheduleSlot } from '@shared/time/schedule';

import { DeliveryRing } from './coverage';

/** "HH:MM" a minutos desde la medianoche. */
export function timeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');

  return Number(hours) * 60 + Number(minutes);
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * El turno como intervalo sobre el mismo día. El que cruza la medianoche se
 * extiende al día siguiente (18:00 → 02:00 pasa a [18:00, 26:00]), así dos
 * turnos del mismo día se comparan sobre una misma recta.
 */
function interval(slot: ScheduleSlot): [number, number] {
  const opens = timeToMinutes(slot.opens);
  const closes = timeToMinutes(slot.closes);

  // Abre y cierra a la misma hora: 24 horas, todo el día.
  if (opens === closes) return [0, MINUTES_PER_DAY];

  const end = closes > opens ? closes : closes + MINUTES_PER_DAY;

  return [opens, end];
}

function overlaps(a: ScheduleSlot, b: ScheduleSlot): boolean {
  const [aStart, aEnd] = interval(a);
  const [bStart, bEnd] = interval(b);

  return aStart < bEnd && bStart < aEnd;
}

/** Dos turnos del mismo día que se pisan, o null si no hay. */
export function findOverlappingSlots(
  schedule: readonly ScheduleSlot[],
): { a: ScheduleSlot; b: ScheduleSlot } | null {
  const byDay = new Map<number, ScheduleSlot[]>();

  for (const slot of schedule) {
    const list = byDay.get(slot.day) ?? [];

    list.push(slot);
    byDay.set(slot.day, list);
  }

  for (const slots of byDay.values()) {
    for (let i = 0; i < slots.length; i += 1) {
      const first = slots[i];

      if (!first) continue;

      for (let j = i + 1; j < slots.length; j += 1) {
        const second = slots[j];

        if (!second) continue;

        if (overlaps(first, second)) return { a: first, b: second };
      }
    }
  }

  return null;
}

/**
 * Anillos ordenados de menor a mayor distancia. Dos anillos con la misma
 * distancia son ambiguos (¿cuál cobra el domicilio?): null.
 */
export function sortRings(rings: readonly DeliveryRing[]): DeliveryRing[] | null {
  const sorted = [...rings].sort((a, b) => a.maxKm - b.maxKm);

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    if (prev && current && current.maxKm === prev.maxKm) return null;
  }

  return sorted;
}
