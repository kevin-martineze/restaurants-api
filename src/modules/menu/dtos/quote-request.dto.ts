import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Una línea del carrito: solo identificadores y cantidad, nunca precios. */
export class QuoteLineDto {
  @ApiProperty({ example: '6720f1c2a1b2c3d4e5f60718' })
  @IsString()
  @Length(1, 64)
  itemId!: string;

  @ApiProperty({ type: [String], example: [] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  modifierIds!: string[];

  @ApiProperty({ required: false, example: 'sin cebolla' })
  @IsOptional()
  @IsString()
  @MaxLength(140)
  note?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(20)
  qty!: number;
}

export class QuoteRequestDto {
  @ApiProperty({ type: [QuoteLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineDto)
  lines!: QuoteLineDto[];
}
