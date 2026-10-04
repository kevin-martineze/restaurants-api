import type { CheckoutFulfillment } from './order-status';

import { formatCop } from '@shared/utils/money';

import type { OpenStatus } from '@shared/time/schedule';

import type { Coverage } from '@modules/organization/domain/coverage';
import type { FulfillmentType } from '@modules/organization/schemas/branch.schema';
import type { Quote } from '@modules/menu/domain/quote';

export interface CheckoutContext {
  quote: Quote;
  status: OpenStatus;
  fulfillment: CheckoutFulfillment;
  /** Lo que ofrece la sede: domicilio, recoger… */
  offered: FulfillmentType[];
  /** La sede tiene ubicación y anillos: puede hacer domicilios. */
  branchDelivers: boolean;
  /** Cobertura del punto marcado; `null` si no se marcó punto. */
  coverage: Coverage | null;
}

export interface CheckoutEvaluation {
  /** Lo que impide pedir, en el orden en que el cliente lo resolvería. */
  blockers: string[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  /** Pedido mínimo de la zona; 0 si no aplica. */
  minOrder: number;
  distanceKm: number | null;
}

/**
 * Decide si el pedido se puede hacer y cuánto cuesta.
 *
 * Es la misma función para la vista previa del checkout y para crear el
 * pedido: lo que el cliente vio es lo que se cobra.
 */
export function evaluateCheckout(context: CheckoutContext): CheckoutEvaluation {
  const { quote, status, fulfillment, offered, branchDelivers, coverage } = context;
  const blockers: string[] = [];

  if (quote.lines.length === 0 && quote.rejected.length === 0) {
    blockers.push('Tu carrito está vacío.');
  }

  if (quote.rejected.length > 0) {
    blockers.push('Hay productos que no podemos preparar. Ajústalos para continuar.');
  }

  if (!status.open) {
    // "p. m." ya trae su punto: no se le agrega otro.
    const end = status.label.endsWith('.') ? '' : '.';

    blockers.push(`No estamos recibiendo pedidos en este momento. ${status.label}${end}`);
  }

  let deliveryFee = 0;
  let minOrder = 0;

  if (fulfillment === 'pickup' && !offered.includes('pickup')) {
    blockers.push('Esta sede no tiene recogida en tienda.');
  }

  if (fulfillment === 'delivery') {
    if (!offered.includes('delivery') || !branchDelivers) {
      blockers.push('Esta sede no hace domicilios. Puedes pedir para recoger.');
    } else if (!coverage) {
      blockers.push('Marca en el mapa dónde te entregamos.');
    } else if (!coverage.covered) {
      blockers.push(
        `Todavía no llegamos hasta allá (estás a ${coverage.distanceKm} km). Puedes pedir para recoger.`,
      );
    } else {
      deliveryFee = coverage.fee;
      minOrder = coverage.minOrder;

      if (quote.subtotal < minOrder) {
        blockers.push(
          `El pedido mínimo para domicilio a tu zona es ${formatCop(minOrder)}. Te faltan ${formatCop(minOrder - quote.subtotal)}.`,
        );
      }
    }
  }

  return {
    blockers,
    subtotal: quote.subtotal,
    deliveryFee,
    total: quote.subtotal + deliveryFee,
    minOrder,
    distanceKm: coverage?.distanceKm ?? null,
  };
}
