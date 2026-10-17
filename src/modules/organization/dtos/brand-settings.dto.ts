import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class BrandThemeDto {
  @ApiPropertyOptional({ example: 'oklch(0.52 0.19 33)' })
  @IsString()
  @MaxLength(64)
  primary!: string;
}

/**
 * La marca que edita el dueño o el gerente. Es un PATCH: solo se cambia lo que
 * viene. El slug no está: es la URL de la carta y de los QR impresos, no se
 * edita desde el panel.
 */
export class UpdateBrandSettingsDto {
  @ApiPropertyOptional({ example: 'La Parrilla de Toño' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Asados al carbón y comida rápida', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  tagline?: string;

  @ApiPropertyOptional({ type: BrandThemeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandThemeDto)
  theme?: BrandThemeDto;
}
