import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QuoteLineDto } from '@modules/menu/dtos/quote-request.dto';

import { CheckoutPreviewDto, CreateOrderDto } from '../dtos/checkout.dto';
import {
  CheckoutInput,
  CheckoutPreview,
  CheckoutService,
  CreatedOrder,
  PublicOrder,
} from '../providers/checkout.service';

function toInput(dto: CheckoutPreviewDto): CheckoutInput {
  return {
    lines: dto.lines.map((line: QuoteLineDto) => ({
      itemId: line.itemId,
      modifierIds: line.modifierIds,
      note: (line.note ?? '').replace(/\s+/g, ' ').trim(),
      qty: line.qty,
    })),
    fulfillment: dto.fulfillment,
    location: dto.location ? { lat: dto.location.lat, lng: dto.location.lng } : null,
  };
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;

@ApiTags('pedidos públicos')
@Controller('public/:slug')
export class PublicOrdersController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post('checkout/preview')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cotiza el pedido completo: domicilio, mínimo y lo que impide pedir.',
  })
  preview(@Param('slug') slug: string, @Body() body: CheckoutPreviewDto): Promise<CheckoutPreview> {
    return this.checkout.preview(slug, toInput(body));
  }

  @Post('orders')
  @HttpCode(201)
  // Crear pedidos es lo que más hay que proteger de abuso en la carta pública.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiHeader({ name: 'idempotency-key', required: true })
  @ApiOperation({ summary: 'Crea el pedido. La misma clave devuelve el mismo pedido.' })
  create(
    @Param('slug') slug: string,
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<CreatedOrder> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new BadRequestException({
        error: 'missing_idempotency_key',
        message: 'Falta la clave del pedido. Recarga la página e intenta de nuevo.',
      });
    }

    return this.checkout.create(slug, body, toInput(body), idempotencyKey);
  }

  @Get('orders/:number')
  @ApiOperation({ summary: 'El pedido para su enlace de seguimiento (requiere el token).' })
  track(
    @Param('slug') slug: string,
    @Param('number', ParseIntPipe) number: number,
    @Query('token') token: string | undefined,
  ): Promise<PublicOrder> {
    return this.checkout.track(slug, number, token ?? '');
  }
}
