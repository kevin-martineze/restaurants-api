import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { canWorkInBranch, StaffContext } from '@shared/auth/staff';
import { Lean } from '@shared/tenancy/tenant-repository';
import { BranchesRepository } from '@modules/organization/providers/branches.repository';
import { PaymentMethod } from '@modules/organization/schemas/branch.schema';

import { CheckoutFulfillment, OrderStatus, PaymentStatus } from '../domain/order-status';
import {
  ACTIVE_STATUSES,
  CancelReason,
  checkTransition,
  COLLECTED_STATUSES,
} from '../domain/transitions';
import { Order } from '../schemas/order.schema';

import { OrderEventsBus } from './order-events.bus';
import { OrdersRepository } from './orders.repository';

/** El pedido como lo ve el equipo: con teléfono, coordenadas e historial. */
export interface StaffOrder {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: CheckoutFulfillment;
  createdAt: string;
  etaMinutes: number;
  customer: { name: string; phone: string };
  address: {
    text: string;
    neighborhood: string;
    references: string;
    lat: number;
    lng: number;
    distanceKm: number;
  } | null;
  items: {
    name: string;
    modifiers: { groupName: string; name: string }[];
    note: string;
    qty: number;
    total: number;
  }[];
  totals: { subtotal: number; deliveryFee: number; total: number };
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    cashTendered: number | null;
    change: number;
  };
  notes: string;
  events: { status: OrderStatus; at: string; actorRole: string; reason: string | null }[];
}

function notFound(): NotFoundException {
  return new NotFoundException({ error: 'not_found', message: 'No encontramos ese pedido.' });
}

export function toStaffOrder(order: Lean<Order>): StaffOrder {
  const [lng = 0, lat = 0] = order.address?.location.coordinates ?? [];

  return {
    id: order._id.toString(),
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    createdAt: (order.events[0]?.at ?? new Date()).toISOString(),
    etaMinutes: order.etaMinutes,
    customer: { name: order.customer.name, phone: order.customer.phone },
    address: order.address
      ? {
          text: order.address.text,
          neighborhood: order.address.neighborhood,
          references: order.address.references,
          lat,
          lng,
          distanceKm: order.address.distanceKm,
        }
      : null,
    items: order.items.map((item) => ({
      name: item.name,
      modifiers: item.modifiers.map((modifier) => ({
        groupName: modifier.groupName,
        name: modifier.name,
      })),
      note: item.note,
      qty: item.qty,
      total: item.total,
    })),
    totals: order.totals,
    payment: {
      method: order.payment.method,
      status: order.payment.status,
      cashTendered: order.payment.cashTendered,
      change:
        order.payment.cashTendered === null
          ? 0
          : Math.max(order.payment.cashTendered - order.totals.total, 0),
    },
    notes: order.notes,
    events: order.events.map((event) => ({
      status: event.status,
      at: event.at.toISOString(),
      actorRole: event.actorRole,
      reason: event.reason,
    })),
  };
}

@Injectable()
export class OrderBoardService {
  constructor(
    private readonly orders: OrdersRepository,
    private readonly branches: BranchesRepository,
    private readonly bus: OrderEventsBus,
  ) {}

  /** Los pedidos vivos de la sede, del más viejo al más nuevo. */
  async active(staff: StaffContext, branchId: string): Promise<StaffOrder[]> {
    const branch = await this.branchFor(staff, branchId);
    const orders = await this.orders.find(staff.tenantId, {
      branchId: branch,
      status: { $in: ACTIVE_STATUSES },
    });

    return orders.sort((a, b) => a.number - b.number).map(toStaffOrder);
  }

  async detail(staff: StaffContext, orderId: string): Promise<StaffOrder> {
    return toStaffOrder(await this.orderFor(staff, orderId));
  }

  /**
   * Mueve el pedido a otro estado. Si dos personas lo mueven a la vez, gana la
   * primera: la segunda recibe un conflicto en vez de pisar el cambio.
   */
  async transition(
    staff: StaffContext,
    orderId: string,
    to: OrderStatus,
    reason: CancelReason | null,
  ): Promise<StaffOrder> {
    const order = await this.orderFor(staff, orderId);
    const check = checkTransition({
      from: order.status,
      to,
      fulfillment: order.fulfillment,
      role: staff.role,
      reason,
    });

    if (!check.ok) {
      throw new UnprocessableEntityException({
        error: 'invalid_transition',
        message: check.message,
      });
    }

    const now = new Date();
    const matched = await this.orders.updateOne(
      staff.tenantId,
      { _id: order._id, status: order.status },
      {
        $set: {
          status: to,
          ...(COLLECTED_STATUSES.includes(to) ? { 'payment.status': 'collected' } : {}),
        },
        $push: { events: { status: to, at: now, actorRole: staff.role, reason } },
      },
    );

    if (matched === 0) {
      throw new ConflictException({
        error: 'order_changed',
        message: 'Alguien más movió este pedido. Ya te mostramos cómo quedó.',
      });
    }

    this.bus.publish({
      kind: 'updated',
      tenantId: staff.tenantId.toString(),
      branchId: order.branchId.toString(),
      orderId: order._id.toString(),
      number: order.number,
      status: to,
      at: now.toISOString(),
    });

    return this.detail(staff, orderId);
  }

  /** La sede del path, si existe en este restaurante y la persona trabaja en ella. */
  async branchFor(staff: StaffContext, branchId: string): Promise<Types.ObjectId> {
    if (!isValidObjectId(branchId)) {
      throw new NotFoundException({ error: 'not_found', message: 'No encontramos esa sede.' });
    }

    const id = new Types.ObjectId(branchId);
    const branch = await this.branches.findOne(staff.tenantId, { _id: id });

    if (!branch) {
      throw new NotFoundException({ error: 'not_found', message: 'No encontramos esa sede.' });
    }

    if (!canWorkInBranch(staff, id)) {
      throw new ForbiddenException({ error: 'forbidden', message: 'No trabajas en esta sede.' });
    }

    return id;
  }

  private async orderFor(staff: StaffContext, orderId: string): Promise<Lean<Order>> {
    if (!isValidObjectId(orderId)) throw notFound();

    const order = await this.orders.findOne(staff.tenantId, {
      _id: new Types.ObjectId(orderId),
    });

    if (!order) throw notFound();

    if (!canWorkInBranch(staff, order.branchId)) {
      throw new ForbiddenException({ error: 'forbidden', message: 'No trabajas en esta sede.' });
    }

    return order;
  }
}
