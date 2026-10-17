import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { StaffRoute } from '@shared/auth/roles.decorator';
import { StaffContext } from '@shared/auth/staff';
import { Staff } from '@shared/auth/staff.decorator';
import { readUpload } from '@shared/media/upload';

import { UpdateBrandSettingsDto } from '../dtos/brand-settings.dto';
import { BrandSettings, BrandSettingsService } from '../providers/brand-settings.service';

/** La marca es del dueño y el gerente. */
const EDITORS = ['owner', 'manager'] as const;

@ApiTags('panel · marca')
@Controller('tenants/:tenantId/brands/:brandId')
export class PanelBrandSettingsController {
  constructor(private readonly settings: BrandSettingsService) {}

  @Get('settings')
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'La marca: nombre, lema, color, logo y portada.' })
  get(@Staff() staff: StaffContext, @Param('brandId') brandId: string): Promise<BrandSettings> {
    return this.settings.settings(staff, brandId);
  }

  @Patch('settings')
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'Cambia nombre, lema o color. El slug no se edita.' })
  patch(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Body() body: UpdateBrandSettingsDto,
  ): Promise<BrandSettings> {
    return this.settings.update(staff, brandId, body);
  }

  @Post('logo')
  @StaffRoute(...EDITORS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube o reemplaza el logo (se achica a 512 px).' })
  async uploadLogo(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Req() request: FastifyRequest,
  ): Promise<BrandSettings> {
    const upload = await readUpload(request);

    return this.settings.setLogo(staff, brandId, upload.buffer);
  }

  @Delete('logo')
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'Quita el logo.' })
  removeLogo(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
  ): Promise<BrandSettings> {
    return this.settings.removeLogo(staff, brandId);
  }

  @Post('cover')
  @StaffRoute(...EDITORS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube o reemplaza la portada (se achica a 1600 px).' })
  async uploadCover(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Req() request: FastifyRequest,
  ): Promise<BrandSettings> {
    const upload = await readUpload(request);

    return this.settings.setCover(staff, brandId, upload.buffer);
  }

  @Delete('cover')
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'Quita la portada.' })
  removeCover(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
  ): Promise<BrandSettings> {
    return this.settings.removeCover(staff, brandId);
  }
}
