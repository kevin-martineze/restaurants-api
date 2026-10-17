import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidObjectId, Types } from 'mongoose';
import { StaffContext } from '@shared/auth/staff';
import { brandImageKey, processCoverImage, processLogoImage } from '@shared/media/images';
import { MediaStorage } from '@shared/storage/media-storage';
import { Lean } from '@shared/tenancy/tenant-repository';

import { Brand } from '../schemas/brand.schema';
import { UpdateBrandSettingsDto } from '../dtos/brand-settings.dto';
import { isSafeColor, primaryForeground } from '../domain/brand-settings';

import { BrandsRepository } from './brands.repository';

/** La marca tal como la edita el dueño o el gerente. */
export interface BrandSettings {
  slug: string;
  name: string;
  tagline: string | null;
  theme: { primary: string; primaryForeground: string };
  logoUrl: string | null;
  coverUrl: string | null;
}

function notFound(): NotFoundException {
  return new NotFoundException({ error: 'not_found', message: 'No encontramos esa marca.' });
}

function invalidColor(): BadRequestException {
  return new BadRequestException({
    error: 'invalid_color',
    message: 'Elige un color válido: un hex o un oklch numérico.',
  });
}

@Injectable()
export class BrandSettingsService {
  constructor(
    private readonly brands: BrandsRepository,
    private readonly storage: MediaStorage,
  ) {}

  async settings(staff: StaffContext, brandId: string): Promise<BrandSettings> {
    return this.toSettings(await this.brand(staff, brandId));
  }

  async update(
    staff: StaffContext,
    brandId: string,
    dto: UpdateBrandSettingsDto,
  ): Promise<BrandSettings> {
    const brand = await this.brand(staff, brandId);
    const set: Record<string, unknown> = {};

    if (dto.name !== undefined) set.name = dto.name.trim();
    if (dto.tagline !== undefined) set.tagline = dto.tagline.trim() || null;

    if (dto.theme?.primary !== undefined) {
      const primary = dto.theme.primary.trim();

      if (!isSafeColor(primary)) throw invalidColor();

      set['theme.primary'] = primary;
      set['theme.primaryForeground'] = primaryForeground(primary);
    }

    if (Object.keys(set).length > 0) {
      await this.brands.updateOne(staff.tenantId, { _id: brand._id }, { $set: set });
    }

    return this.settings(staff, brandId);
  }

  async setLogo(staff: StaffContext, brandId: string, original: Buffer): Promise<BrandSettings> {
    const brand = await this.brand(staff, brandId);
    const body = await processLogoImage(original);
    const key = brandImageKey(staff.tenantId.toString(), brand._id.toString(), 'logo');

    await this.storage.put([{ key, body, contentType: 'image/webp' }]);
    await this.brands.updateOne(
      staff.tenantId,
      { _id: brand._id },
      { $set: { logoUrl: this.storage.publicUrl(key), logoKey: key } },
    );

    if (brand.logoKey) await this.storage.remove([brand.logoKey]);

    return this.settings(staff, brandId);
  }

  async removeLogo(staff: StaffContext, brandId: string): Promise<BrandSettings> {
    const brand = await this.brand(staff, brandId);

    await this.brands.updateOne(
      staff.tenantId,
      { _id: brand._id },
      { $set: { logoUrl: null, logoKey: null } },
    );

    if (brand.logoKey) await this.storage.remove([brand.logoKey]);

    return this.settings(staff, brandId);
  }

  async setCover(staff: StaffContext, brandId: string, original: Buffer): Promise<BrandSettings> {
    const brand = await this.brand(staff, brandId);
    const body = await processCoverImage(original);
    const key = brandImageKey(staff.tenantId.toString(), brand._id.toString(), 'cover');

    await this.storage.put([{ key, body, contentType: 'image/webp' }]);
    await this.brands.updateOne(
      staff.tenantId,
      { _id: brand._id },
      { $set: { coverUrl: this.storage.publicUrl(key), coverKey: key } },
    );

    if (brand.coverKey) await this.storage.remove([brand.coverKey]);

    return this.settings(staff, brandId);
  }

  async removeCover(staff: StaffContext, brandId: string): Promise<BrandSettings> {
    const brand = await this.brand(staff, brandId);

    await this.brands.updateOne(
      staff.tenantId,
      { _id: brand._id },
      { $set: { coverUrl: null, coverKey: null } },
    );

    if (brand.coverKey) await this.storage.remove([brand.coverKey]);

    return this.settings(staff, brandId);
  }

  private idFor(staff: StaffContext, brandId: string): Types.ObjectId {
    if (!isValidObjectId(brandId)) throw notFound();

    return new Types.ObjectId(brandId);
  }

  private async brand(staff: StaffContext, brandId: string): Promise<Lean<Brand>> {
    const brand = await this.brands.findOne(staff.tenantId, {
      _id: this.idFor(staff, brandId),
    });

    if (!brand) throw notFound();

    return brand;
  }

  private toSettings(brand: Brand): BrandSettings {
    return {
      slug: brand.slug,
      name: brand.name,
      tagline: brand.tagline,
      theme: { primary: brand.theme.primary, primaryForeground: brand.theme.primaryForeground },
      logoUrl: brand.logoUrl,
      coverUrl: brand.coverUrl,
    };
  }
}
