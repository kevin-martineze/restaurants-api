import { Injectable } from '@nestjs/common';
import { filter, Observable, Subject } from 'rxjs';

import { OrderStatus } from '../domain/order-status';

export interface OrderEvent {
  kind: 'created' | 'updated';
  tenantId: string;
  branchId: string;
  orderId: string;
  number: number;
  status: OrderStatus;
  at: string;
}

/**
 * Avisos de pedidos nuevos o que cambiaron, para el tablero en vivo.
 *
 * En memoria: sirve mientras la API corre en una sola instancia. Con varias,
 * esto se reemplaza por Redis pub/sub (o change streams) sin cambiar a quien
 * publica ni a quien escucha.
 */
@Injectable()
export class OrderEventsBus {
  private readonly events = new Subject<OrderEvent>();

  publish(event: OrderEvent): void {
    this.events.next(event);
  }

  forBranch(tenantId: string, branchId: string): Observable<OrderEvent> {
    return this.events.pipe(
      filter((event) => event.tenantId === tenantId && event.branchId === branchId),
    );
  }
}
