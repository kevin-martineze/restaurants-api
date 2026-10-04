import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { ORDER_STATUSES, OrderStatus } from '../domain/order-status';
import { CANCEL_REASONS, CancelReason } from '../domain/transitions';

export class TransitionDto {
  @ApiProperty({ enum: ORDER_STATUSES, example: 'accepted' })
  @IsIn(ORDER_STATUSES)
  to!: OrderStatus;

  @ApiPropertyOptional({ enum: CANCEL_REASONS, description: 'Obligatorio para cancelar.' })
  @IsOptional()
  @IsIn(CANCEL_REASONS)
  reason?: CancelReason;
}
