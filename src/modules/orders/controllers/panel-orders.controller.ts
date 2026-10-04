import { Body, Controller, Get, MessageEvent, Param, Post, Sse } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { interval, map, merge, Observable } from 'rxjs';
import { StaffRoute } from '@shared/auth/roles.decorator';
import { StaffContext } from '@shared/auth/staff';
import { Staff } from '@shared/auth/staff.decorator';

import { TransitionDto } from '../dtos/transition.dto';
import { OrderBoardService, StaffOrder } from '../providers/order-board.service';
import { OrderEventsBus } from '../providers/order-events.bus';

/** Cada cuánto se manda un latido: los proxies cortan conexiones mudas. */
const HEARTBEAT_MS = 25_000;

@ApiTags('panel · pedidos')
@Controller('tenants/:tenantId')
@StaffRoute()
export class PanelOrdersController {
  constructor(
    private readonly board: OrderBoardService,
    private readonly bus: OrderEventsBus,
  ) {}

  @Get('branches/:branchId/orders')
  @ApiOperation({ summary: 'Pedidos vivos de la sede, para el tablero.' })
  active(@Staff() staff: StaffContext, @Param('branchId') branchId: string): Promise<StaffOrder[]> {
    return this.board.active(staff, branchId);
  }

  @Sse('branches/:branchId/orders/events')
  @SkipThrottle()
  @ApiOperation({ summary: 'Avisos en vivo (SSE) de pedidos nuevos o que cambian.' })
  async events(
    @Staff() staff: StaffContext,
    @Param('branchId') branchId: string,
  ): Promise<Observable<MessageEvent>> {
    const branch = await this.board.branchFor(staff, branchId);

    return merge(
      this.bus
        .forBranch(staff.tenantId.toString(), branch.toString())
        .pipe(map((event): MessageEvent => ({ type: 'order', data: event }))),
      interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} }))),
    );
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Un pedido con datos del cliente e historial.' })
  detail(@Staff() staff: StaffContext, @Param('orderId') orderId: string): Promise<StaffOrder> {
    return this.board.detail(staff, orderId);
  }

  @Post('orders/:orderId/transitions')
  @ApiOperation({ summary: 'Mueve el pedido a otro estado (aceptar, listo, despachar…).' })
  transition(
    @Staff() staff: StaffContext,
    @Param('orderId') orderId: string,
    @Body() body: TransitionDto,
  ): Promise<StaffOrder> {
    return this.board.transition(staff, orderId, body.to, body.reason ?? null);
  }
}
