import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { formatCop } from '@shared/utils/money';
import { normalizeColombianMobile } from '@shared/utils/phone';
import { CustomersRepository } from '@modules/customers/providers/customers.repository';
import { Quote, QuoteRequestLine, quoteLines } from '@modules/menu/domain/quote';
import {
  branchStatus,
  PublicMenuService,
  ResolvedMenu,
} from '@modules/menu/providers/public-menu.service';
import { coverageFor, GeoPoint } from '@modules/organization/domain/coverage';
import { kitchenStatus } from '@modules/organization/domain/kitchen';
import { PaymentMethod } from '@modules/organization/schemas/branch.schema';

import { CheckoutEvaluation, evaluateCheckout } from '../domain/checkout';
import { CheckoutFulfillment, OrderStatus } from '../domain/order-status';
import { CreateOrderDto } from '../dtos/checkout.dto';

import { OrderCountersRepository } from './order-counters.repository';
import { OrdersRepository } from './orders.repository';

/** Versión del texto de autorización de datos que ve el cliente en el checkout. */
export const CONSENT_VERSION = '2026-10-v1';

export interface CheckoutInput {
  lines: QuoteRequestLine[];
  fulfillment: CheckoutFulfillment;
  location: GeoPoint | null;
}

export interface CheckoutPreview extends Quote, CheckoutEvaluation {
  etaMinutes: number;
  paymentMethods: PaymentMethod[];
}

export interface CreatedOrder {
  number: number;
  trackingToken: string;
  total: number;
  etaMinutes: number;
}

/** El pedido como lo ve el cliente en su enlace de seguimiento. Sin teléfono. */
export interface PublicOrder {
  number: number;
  status: OrderStatus;
  fulfillment: CheckoutFulfillment;
  createdAt: string;
  etaMinutes: number;
  restaurant: { name: string; slug: string };
  branch: { name: string; address: string };
  customerName: string;
  address: { text: string; neighborhood: string; references: string } | null;
  items: { name: string; modifiersLabel: string; note: string; qty: number; total: number }[];
  totals: { subtotal: number; deliveryFee: number; total: number };
  payment: { method: PaymentMethod; cashTendered: number | null };
  notes: string;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly menu: PublicMenuService,
    private readonly orders: OrdersRepository,
    private readonly counters: OrderCountersRepository,
    private readonly customers: CustomersRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Lo que costaría el pedido y qué impide hacerlo, sin crear nada. */
  async preview(slug: string, input: CheckoutInput, now = new Date()): Promise<CheckoutPreview> {
    return this.evaluate(await this.menu.resolve(slug), input, now);
  }

  /**
   * Crea el pedido. Vuelve a evaluar todo en el servidor (precio, horario,
   * cobertura): lo que mande el navegador no decide nada.
   */
  async create(
    slug: string,
    dto: CreateOrderDto,
    input: CheckoutInput,
    idempotencyKey: string,
    now = new Date(),
  ): Promise<CreatedOrder> {
    const resolved = await this.menu.resolve(slug);
    const { brand, branch } = resolved;

    const existing = await this.orders.findByIdempotencyKey(brand.tenantId, idempotencyKey);

    if (existing) return this.summary(existing);

    const phone = normalizeColombianMobile(dto.customer.phone);

    if (!phone) {
      throw new BadRequestException({
        error: 'invalid_phone',
        message: 'Escribe un celular de Colombia de 10 dígitos, como 300 123 4567.',
      });
    }

    const preview = this.evaluate(resolved, input, now);

    if (preview.blockers.length > 0) {
      throw new UnprocessableEntityException({
        error: 'not_orderable',
        message: preview.blockers[0],
        details: { blockers: preview.blockers, rejected: preview.rejected },
      });
    }

    if (!preview.paymentMethods.includes(dto.payment.method)) {
      throw new BadRequestException({
        error: 'payment_method_unavailable',
        message: 'Este restaurante no recibe ese medio de pago.',
      });
    }

    const cashTendered = dto.payment.method === 'cash' ? (dto.payment.cashTendered ?? null) : null;

    if (cashTendered !== null && cashTendered < preview.total) {
      throw new BadRequestException({
        error: 'cash_short',
        message: `Con eso no alcanza: el total es ${formatCop(preview.total)}.`,
      });
    }

    const address =
      input.fulfillment === 'delivery' && dto.address && input.location
        ? {
            text: dto.address.text.trim(),
            neighborhood: dto.address.neighborhood?.trim() ?? '',
            references: dto.address.references?.trim() ?? '',
            location: {
              type: 'Point' as const,
              coordinates: [input.location.lng, input.location.lat] as [number, number],
            },
          }
        : null;
    const trackingToken = randomBytes(18).toString('base64url');

    try {
      const number = await this.connection.transaction(async (session) => {
        const next = await this.counters.next(brand.tenantId, branch._id, session);
        const customerId = await this.customers.recordOrder(
          brand.tenantId,
          {
            phone,
            name: dto.customer.name.trim(),
            marketing: dto.consent.marketing,
            consentVersion: CONSENT_VERSION,
            address,
          },
          now,
          session,
        );

        await this.orders.create(
          brand.tenantId,
          {
            brandId: brand._id,
            branchId: branch._id,
            number: next,
            trackingToken,
            channel: 'web',
            fulfillment: input.fulfillment,
            customer: { customerId, name: dto.customer.name.trim(), phone },
            address: address ? { ...address, distanceKm: preview.distanceKm ?? 0 } : null,
            items: preview.lines.map((line) => ({
              itemId: line.itemId,
              name: line.name,
              modifiers: line.modifiers.map((modifier) => ({
                modifierId: modifier.id,
                groupName: modifier.groupName,
                name: modifier.name,
                priceDelta: modifier.priceDelta,
              })),
              note: line.note,
              qty: line.qty,
              unitPrice: line.unitPrice,
              total: line.total,
            })),
            totals: {
              subtotal: preview.subtotal,
              deliveryFee: preview.deliveryFee,
              total: preview.total,
            },
            payment: { method: dto.payment.method, status: 'pending', cashTendered },
            etaMinutes: preview.etaMinutes,
            notes: dto.notes?.trim() ?? '',
            status: 'received',
            events: [{ status: 'received', at: now, actorRole: 'customer', reason: null }],
            idempotencyKey,
          },
          session,
        );

        return next;
      });

      return { number, trackingToken, total: preview.total, etaMinutes: preview.etaMinutes };
    } catch (error) {
      // Dos envíos idénticos al mismo tiempo: el segundo choca con el índice
      // de la clave y recibe el pedido que creó el primero.
      if (isDuplicateKey(error)) {
        const created = await this.orders.findByIdempotencyKey(brand.tenantId, idempotencyKey);

        if (created) return this.summary(created);
      }

      throw error;
    }
  }

  /** El pedido para su enlace de seguimiento. Sin el token correcto, no existe. */
  async track(slug: string, number: number, token: string): Promise<PublicOrder> {
    const { brand, branch } = await this.menu.resolve(slug);
    const order = await this.orders.findOne(brand.tenantId, {
      branchId: branch._id,
      number,
      trackingToken: token,
    });

    if (!order) {
      throw new NotFoundException({ error: 'not_found', message: 'No encontramos ese pedido.' });
    }

    return {
      number: order.number,
      status: order.status,
      fulfillment: order.fulfillment,
      createdAt: (order.events[0]?.at ?? new Date()).toISOString(),
      etaMinutes: order.etaMinutes,
      restaurant: { name: brand.name, slug: brand.slug },
      branch: { name: branch.name, address: branch.address },
      customerName: order.customer.name,
      address: order.address
        ? {
            text: order.address.text,
            neighborhood: order.address.neighborhood,
            references: order.address.references,
          }
        : null,
      items: order.items.map((item) => ({
        name: item.name,
        modifiersLabel: item.modifiers.map((modifier) => modifier.name).join(' · '),
        note: item.note,
        qty: item.qty,
        total: item.total,
      })),
      totals: order.totals,
      payment: { method: order.payment.method, cashTendered: order.payment.cashTendered },
      notes: order.notes,
    };
  }

  private evaluate(resolved: ResolvedMenu, input: CheckoutInput, now: Date): CheckoutPreview {
    const { branch, categories } = resolved;
    const quote = quoteLines(categories, input.lines);
    const kitchen = kitchenStatus(branch.kitchenLoad, branch.etaMinutes);
    const [lng, lat] = branch.location?.coordinates ?? [];
    const branchPoint = lat !== undefined && lng !== undefined ? { lat, lng } : null;
    const branchDelivers = branchPoint !== null && branch.deliveryRings.length > 0;
    const coverage =
      input.fulfillment === 'delivery' && input.location && branchPoint
        ? coverageFor(branchPoint, branch.deliveryRings, input.location)
        : null;

    const evaluation = evaluateCheckout({
      quote,
      status: branchStatus(branch, now),
      fulfillment: input.fulfillment,
      offered: branch.fulfillment,
      branchDelivers,
      coverage,
    });

    return {
      ...quote,
      ...evaluation,
      etaMinutes: kitchen.etaMinutes,
      paymentMethods: branch.paymentMethods,
    };
  }

  private summary(order: {
    number: number;
    trackingToken: string;
    totals: { total: number };
    etaMinutes: number;
  }): CreatedOrder {
    return {
      number: order.number,
      trackingToken: order.trackingToken,
      total: order.totals.total,
      etaMinutes: order.etaMinutes,
    };
  }
}
