import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { FULFILLMENT_TYPES, PAYMENT_METHODS } from '../schemas/branch.schema';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Cómo se ofrece el pedido en esta sede. `dine_in` aún no se ofrece. */
const OFFERED_FULFILLMENTS = FULFILLMENT_TYPES.filter((type) => type !== 'dine_in');

export class ScheduleSlotDto {
  @ApiProperty({ example: 1, description: '0 = domingo … 6 = sábado.' })
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiProperty({ example: '11:00' })
  @IsString()
  @Matches(TIME_PATTERN)
  opens!: string;

  @ApiProperty({
    example: '22:00',
    description: 'Menor o igual que opens: cierra al día siguiente.',
  })
  @IsString()
  @Matches(TIME_PATTERN)
  closes!: string;
}

export class LocationDto {
  @ApiProperty({ example: 10.9965 })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -74.8066 })
  @IsLongitude()
  lng!: number;
}

export class DeliveryRingDto {
  @ApiProperty({ example: 3, description: 'Hasta esta distancia, en kilómetros.' })
  @IsNumber()
  @Min(0.1)
  @Max(50)
  maxKm!: number;

  @ApiProperty({ example: 3000, description: 'Costo del domicilio, en pesos.' })
  @IsInt()
  @Min(0)
  fee!: number;

  @ApiProperty({ example: 20000, description: 'Pedido mínimo del anillo, en pesos.' })
  @IsInt()
  @Min(0)
  minOrder!: number;
}

/** La configuración completa de la sede. Es un PUT: reemplaza todo. */
export class UpdateBranchSettingsDto {
  @ApiProperty({ example: 'Sede El Prado' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'El Prado, Barranquilla' })
  @IsString()
  @MaxLength(200)
  address!: string;

  @ApiProperty({ type: [ScheduleSlotDto] })
  @IsArray()
  @ArrayMaxSize(28)
  @ValidateNested({ each: true })
  @Type(() => ScheduleSlotDto)
  schedule!: ScheduleSlotDto[];

  @ApiProperty({ example: 35, description: 'Preparación + entrega, en minutos.' })
  @IsInt()
  @Min(5)
  @Max(240)
  etaMinutes!: number;

  @ApiProperty({ enum: OFFERED_FULFILLMENTS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(OFFERED_FULFILLMENTS, { each: true })
  fulfillment!: (typeof OFFERED_FULFILLMENTS)[number][];

  @ApiPropertyOptional({ type: LocationDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto | null;

  @ApiProperty({ type: [DeliveryRingDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => DeliveryRingDto)
  deliveryRings!: DeliveryRingDto[];

  @ApiProperty({ enum: PAYMENT_METHODS, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(PAYMENT_METHODS, { each: true })
  paymentMethods!: (typeof PAYMENT_METHODS)[number][];
}
