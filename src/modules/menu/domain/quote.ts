import type { SnapshotCategory } from './snapshot';

import { selectionLabel, selectionProblems, unitPrice } from './pricing';
import { findSnapshotItem } from './snapshot';

export interface QuoteRequestLine {
  itemId: string;
  modifierIds: string[];
  note: string;
  qty: number;
}

export interface QuotedLine {
  /** Posición de la línea en la petición: el cliente la usa para ubicarla. */
  index: number;
  itemId: string;
  modifierIds: string[];
  name: string;
  modifiersLabel: string;
  note: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface RejectedLine {
  index: number;
  name: string;
  reason: string;
}

export interface Quote {
  lines: QuotedLine[];
  rejected: RejectedLine[];
  subtotal: number;
}

/**
 * Cotiza un carrito contra el menú publicado.
 *
 * No falla por una línea mala: la rechaza con su motivo y cotiza el resto,
 * para que el cliente vea qué ajustar sin perder lo demás.
 */
export function quoteLines(
  categories: readonly SnapshotCategory[],
  lines: readonly QuoteRequestLine[],
): Quote {
  const quoted: QuotedLine[] = [];
  const rejected: RejectedLine[] = [];

  lines.forEach((line, index) => {
    const item = findSnapshotItem(categories, line.itemId);

    if (!item) {
      rejected.push({ index, name: 'Producto', reason: 'Este producto ya no está en la carta.' });

      return;
    }

    const [problem] = selectionProblems(item, line.modifierIds);

    if (problem) {
      rejected.push({ index, name: item.name, reason: problem });

      return;
    }

    const price = unitPrice(item, line.modifierIds);

    quoted.push({
      index,
      itemId: item.id,
      modifierIds: line.modifierIds,
      name: item.name,
      modifiersLabel: selectionLabel(item, line.modifierIds),
      note: line.note,
      qty: line.qty,
      unitPrice: price,
      total: price * line.qty,
    });
  });

  return {
    lines: quoted,
    rejected,
    subtotal: quoted.reduce((sum, line) => sum + line.total, 0),
  };
}
