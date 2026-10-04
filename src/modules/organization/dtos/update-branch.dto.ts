import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { KITCHEN_LOADS, KitchenLoad } from '../schemas/branch.schema';

/** Lo que el turno cambia en vivo: pausar pedidos y cuánta carga tiene la cocina. */
export class UpdateBranchLiveDto {
  @ApiPropertyOptional({ enum: ['open', 'paused'], description: 'Pausar o reanudar pedidos.' })
  @IsOptional()
  @IsIn(['open', 'paused'])
  status?: 'open' | 'paused';

  @ApiPropertyOptional({ enum: KITCHEN_LOADS })
  @IsOptional()
  @IsIn(KITCHEN_LOADS)
  kitchenLoad?: KitchenLoad;
}
