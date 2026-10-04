import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Quote } from '../domain/quote';
import { QuoteRequestDto } from '../dtos/quote-request.dto';
import { PublicMenu, PublicMenuService } from '../providers/public-menu.service';

@ApiTags('carta pública')
@Controller('public/:slug')
export class PublicMenuController {
  constructor(private readonly menu: PublicMenuService) {}

  @Get('menu')
  @ApiOperation({ summary: 'Carta publicada del restaurante, con su estado abierto o cerrado.' })
  getMenu(@Param('slug') slug: string): Promise<PublicMenu> {
    return this.menu.getMenu(slug);
  }

  @Post('quote')
  @HttpCode(200)
  // Cotizar es barato pero público: un techo por IP evita que se use para
  // martillar la base.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cotiza un carrito: precios del servidor y líneas rechazadas.' })
  quote(@Param('slug') slug: string, @Body() body: QuoteRequestDto): Promise<Quote> {
    return this.menu.quote(
      slug,
      body.lines.map((line) => ({
        itemId: line.itemId,
        modifierIds: line.modifierIds,
        note: (line.note ?? '').replace(/\s+/g, ' ').trim(),
        qty: line.qty,
      })),
    );
  }
}
