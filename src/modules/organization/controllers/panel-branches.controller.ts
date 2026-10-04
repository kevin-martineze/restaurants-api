import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { isValidObjectId, Types } from 'mongoose';
import { StaffRoute } from '@shared/auth/roles.decorator';
import { canWorkInBranch, StaffContext } from '@shared/auth/staff';
import { Staff } from '@shared/auth/staff.decorator';

import { kitchenStatus, KitchenStatus } from '../domain/kitchen';
import { UpdateBranchLiveDto } from '../dtos/update-branch.dto';
import { BranchesRepository } from '../providers/branches.repository';
import { BranchStatus } from '../schemas/branch.schema';

export interface BranchLive {
  id: string;
  name: string;
  status: BranchStatus;
  kitchen: KitchenStatus;
}

function notFound(): NotFoundException {
  return new NotFoundException({ error: 'not_found', message: 'No encontramos esa sede.' });
}

@ApiTags('panel · sedes')
@Controller('tenants/:tenantId/branches/:branchId')
export class PanelBranchesController {
  constructor(private readonly branches: BranchesRepository) {}

  @Get()
  @StaffRoute()
  @ApiOperation({ summary: 'Estado en vivo de la sede: pausa y carga de la cocina.' })
  get(@Staff() staff: StaffContext, @Param('branchId') branchId: string): Promise<BranchLive> {
    return this.live(staff, branchId);
  }

  @Patch()
  @StaffRoute('owner', 'manager', 'cashier')
  @ApiOperation({ summary: 'Pausar o reanudar pedidos y marcar la carga de la cocina.' })
  async update(
    @Staff() staff: StaffContext,
    @Param('branchId') branchId: string,
    @Body() body: UpdateBranchLiveDto,
  ): Promise<BranchLive> {
    const id = this.idFor(staff, branchId);
    const changes = {
      ...(body.status ? { status: body.status } : {}),
      ...(body.kitchenLoad ? { kitchenLoad: body.kitchenLoad } : {}),
    };

    if (Object.keys(changes).length > 0) {
      const matched = await this.branches.updateOne(staff.tenantId, { _id: id }, { $set: changes });

      if (matched === 0) throw notFound();
    }

    return this.live(staff, branchId);
  }

  private idFor(staff: StaffContext, branchId: string): Types.ObjectId {
    if (!isValidObjectId(branchId)) throw notFound();

    const id = new Types.ObjectId(branchId);

    if (!canWorkInBranch(staff, id)) throw notFound();

    return id;
  }

  private async live(staff: StaffContext, branchId: string): Promise<BranchLive> {
    const branch = await this.branches.findOne(staff.tenantId, {
      _id: this.idFor(staff, branchId),
    });

    if (!branch) throw notFound();

    return {
      id: branch._id.toString(),
      name: branch.name,
      status: branch.status,
      kitchen: kitchenStatus(branch.kitchenLoad, branch.etaMinutes),
    };
  }
}
