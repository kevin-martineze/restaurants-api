import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { CATEGORY_ROLES, CategoryRole, ITEM_TAGS, ItemTag } from '../domain/snapshot';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Hamburguesas' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ enum: CATEGORY_ROLES })
  @IsOptional()
  @IsIn(CATEGORY_ROLES)
  role?: CategoryRole;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @ApiPropertyOptional({ enum: CATEGORY_ROLES })
  @IsOptional()
  @IsIn(CATEGORY_ROLES)
  role?: CategoryRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids!: string[];
}

export class CreateItemDto {
  @ApiProperty()
  @IsMongoId()
  categoryId!: string;

  @ApiProperty({ example: 'Sencilla' })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 18000 })
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({ enum: ITEM_TAGS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(ITEM_TAGS, { each: true })
  tags?: ItemTag[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsMongoId({ each: true })
  modifierGroupIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsMongoId({ each: true })
  pairsWith?: string[];
}

/** Editar: los mismos campos, todos opcionales. */
export class UpdateItemDto extends PartialType(CreateItemDto) {}

export class AvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  available!: boolean;
}

export class ModifierInputDto {
  /** Si viene, se conserva el id (los carritos y pedidos lo usan). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  id?: string;

  @ApiProperty({ example: 'Tocineta' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ example: 3000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priceDelta!: number;

  @ApiProperty()
  @IsBoolean()
  available!: boolean;
}

export class GroupDto {
  @ApiProperty({ example: 'Adiciones' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Max(20)
  min!: number;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(20)
  max!: number;

  @ApiProperty({ type: [ModifierInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ModifierInputDto)
  modifiers!: ModifierInputDto[];
}
