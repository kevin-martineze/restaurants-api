import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { QuoteLineDto } from '@modules/menu/dtos/quote-request.dto';
import { PAYMENT_METHODS, PaymentMethod } from '@modules/organization/schemas/branch.schema';

import { CHECKOUT_FULFILLMENTS, CheckoutFulfillment } from '../domain/order-status';

export class LocationDto {
  @ApiProperty({ example: 11.0035 })
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: -74.8155 })
  @IsLongitude()
  lng!: number;
}

/** Lo que hace falta para cotizar el pedido completo, domicilio incluido. */
export class CheckoutPreviewDto {
  @ApiProperty({ type: [QuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];

  @ApiProperty({ enum: CHECKOUT_FULFILLMENTS })
  @IsIn(CHECKOUT_FULFILLMENTS)
  fulfillment!: CheckoutFulfillment;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class CustomerDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @Length(2, 80)
  name!: string;

  /** Se normaliza a E.164 en el servicio; aquí solo se acota. */
  @ApiProperty({ example: '300 123 4567' })
  @IsString()
  @Length(7, 20)
  phone!: string;
}

export class AddressDto {
  @ApiProperty({ example: 'Calle 76 #54-30, apto 302' })
  @IsString()
  @Length(5, 200)
  text!: string;

  @ApiPropertyOptional({ example: 'El Prado' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'Edificio blanco, portón negro' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  references?: string;
}

export class PaymentDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method!: PaymentMethod;

  /** Con cuánto paga en efectivo, para llevar el cambio. Vacío: paga exacto. */
  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  cashTendered?: number;
}

export class ConsentDto {
  /** Sin esta autorización no se puede gestionar el pedido (Ley 1581). */
  @ApiProperty({ example: true })
  @Equals(true, { message: 'Necesitamos tu autorización para gestionar el pedido.' })
  service!: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  marketing!: boolean;
}

export class CreateOrderDto extends CheckoutPreviewDto {
  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiPropertyOptional({ type: AddressDto, description: 'Obligatoria para domicilio.' })
  @ValidateIf((dto: CreateOrderDto) => dto.fulfillment === 'delivery')
  @IsDefined({ message: 'Escribe la dirección de entrega.' })
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiProperty({ type: PaymentDto })
  @ValidateNested()
  @Type(() => PaymentDto)
  payment!: PaymentDto;

  @ApiPropertyOptional({ example: 'Timbre dañado, llamar al llegar' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  notes?: string;

  @ApiProperty({ type: ConsentDto })
  @ValidateNested()
  @Type(() => ConsentDto)
  consent!: ConsentDto;
}
