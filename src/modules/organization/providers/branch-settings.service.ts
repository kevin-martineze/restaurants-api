import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { canWorkInBranch, StaffContext } from '@shared/auth/staff';
import { Lean } from '@shared/tenancy/tenant-repository';

import { findOverlappingSlots, sortRings } from '../domain/branch-settings';
import { Branch, FulfillmentType, PaymentMethod } from '../schemas/branch.schema';
import { UpdateBranchSettingsDto } from '../dtos/branch-settings.dto';

import { BranchesRepository } from './branches.repository';

/** La configuración de la sede tal como la edita el dueño o el gerente. */
export interface BranchSettings {
  name: string;
  address: string;
  schedule: { day: number; opens: string; closes: string }[];
  etaMinutes: number;
  fulfillment: FulfillmentType[];
  /** En el orden del mapa: lat/lng. `null`: la sede no hace domicilios. */
  location: { lat: number; lng: number } | null;
  deliveryRings: { maxKm: number; fee: number; minOrder: number }[];
  paymentMethods: PaymentMethod[];
}

function notFound(): NotFoundException {
  return new NotFoundException({ error: 'not_found', message: 'No encontramos esa sede.' });
}

@Injectable()
export class BranchSettingsService {
  constructor(private readonly branches: BranchesRepository) {}

  async settings(staff: StaffContext, branchId: string): Promise<BranchSettings> {
    return this.toSettings(await this.branch(staff, branchId));
  }

  async update(
    staff: StaffContext,
    branchId: string,
    dto: UpdateBranchSettingsDto,
  ): Promise<BranchSettings> {
    const branch = await this.branch(staff, branchId);

    const rings = sortRings(dto.deliveryRings);

    if (rings === null) {
      throw new BadRequestException({
        error: 'invalid_rings',
        message: 'Los anillos van de menor a mayor distancia, sin repetir.',
      });
    }

    if (dto.fulfillment.includes('delivery') && (!dto.location || rings.length === 0)) {
      throw new BadRequestException({
        error: 'delivery_without_coverage',
        message: 'Para ofrecer domicilio marca la ubicación y agrega al menos un anillo.',
      });
    }

    if (findOverlappingSlots(dto.schedule)) {
      throw new BadRequestException({
        error: 'overlapping_schedule',
        message: 'Hay turnos del mismo día que se pisan. Revisa el horario.',
      });
    }

    await this.branches.updateOne(
      staff.tenantId,
      { _id: branch._id },
      {
        $set: {
          name: dto.name.trim(),
          address: dto.address.trim(),
          schedule: dto.schedule,
          etaMinutes: dto.etaMinutes,
          fulfillment: dto.fulfillment,
          location: dto.location
            ? {
                type: 'Point' as const,
                coordinates: [dto.location.lng, dto.location.lat] as [number, number],
              }
            : null,
          deliveryRings: rings,
          paymentMethods: dto.paymentMethods,
        },
      },
    );

    const updated = await this.branches.findOne(staff.tenantId, { _id: branch._id });

    if (!updated) throw notFound();

    return this.toSettings(updated);
  }

  private idFor(staff: StaffContext, branchId: string): Types.ObjectId {
    if (!isValidObjectId(branchId)) throw notFound();

    const id = new Types.ObjectId(branchId);

    if (!canWorkInBranch(staff, id)) throw notFound();

    return id;
  }

  private async branch(staff: StaffContext, branchId: string): Promise<Lean<Branch>> {
    const branch = await this.branches.findOne(staff.tenantId, {
      _id: this.idFor(staff, branchId),
    });

    if (!branch) throw notFound();

    return branch;
  }

  private toSettings(branch: Branch): BranchSettings {
    const [lng, lat] = branch.location?.coordinates ?? [];

    return {
      name: branch.name,
      address: branch.address,
      schedule: branch.schedule.map((slot) => ({
        day: slot.day,
        opens: slot.opens,
        closes: slot.closes,
      })),
      etaMinutes: branch.etaMinutes,
      fulfillment: [...branch.fulfillment],
      location: lat !== undefined && lng !== undefined ? { lat, lng } : null,
      deliveryRings: branch.deliveryRings.map((ring) => ({
        maxKm: ring.maxKm,
        fee: ring.fee,
        minOrder: ring.minOrder,
      })),
      paymentMethods: [...branch.paymentMethods],
    };
  }
}
