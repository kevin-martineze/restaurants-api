import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffRoute } from '@shared/auth/roles.decorator';
import { StaffContext } from '@shared/auth/staff';
import { Staff } from '@shared/auth/staff.decorator';

import { UpdateBranchSettingsDto } from '../dtos/branch-settings.dto';
import { BranchSettings, BranchSettingsService } from '../providers/branch-settings.service';

/** La configuración de la sede es del dueño y el gerente. */
const EDITORS = ['owner', 'manager'] as const;

@ApiTags('panel · sedes')
@Controller('tenants/:tenantId/branches/:branchId/settings')
export class PanelBranchSettingsController {
  constructor(private readonly settings: BranchSettingsService) {}

  @Get()
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'La configuración de la sede: datos, horario, entrega y anillos.' })
  get(@Staff() staff: StaffContext, @Param('branchId') branchId: string): Promise<BranchSettings> {
    return this.settings.settings(staff, branchId);
  }

  @Put()
  @StaffRoute(...EDITORS)
  @ApiOperation({ summary: 'Reemplaza la configuración de la sede.' })
  put(
    @Staff() staff: StaffContext,
    @Param('branchId') branchId: string,
    @Body() body: UpdateBranchSettingsDto,
  ): Promise<BranchSettings> {
    return this.settings.update(staff, branchId, body);
  }
}
