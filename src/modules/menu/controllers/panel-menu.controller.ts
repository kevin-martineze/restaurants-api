import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { StaffRoute } from '@shared/auth/roles.decorator';
import { Role } from '@modules/auth/schemas/membership.schema';
import { StaffContext } from '@shared/auth/staff';
import { Staff } from '@shared/auth/staff.decorator';
import { readUpload } from '@shared/media/upload';

import {
  AvailabilityDto,
  CreateCategoryDto,
  CreateItemDto,
  GroupDto,
  ReorderDto,
  UpdateCategoryDto,
  UpdateItemDto,
} from '../dtos/menu-admin.dto';
import { AdminMenu, MenuAdminService } from '../providers/menu-admin.service';

/** Editar la carta es del dueño y el gerente. */
const EDITORS: Role[] = ['owner', 'manager'];

@ApiTags('panel · carta')
@Controller('tenants/:tenantId/brands/:brandId/menu')
export class PanelMenuController {
  constructor(private readonly admin: MenuAdminService) {}

  @Get()
  @StaffRoute()
  @ApiOperation({ summary: 'La carta completa para editar, con lo inactivo y lo agotado.' })
  menu(@Staff() staff: StaffContext, @Param('brandId') brandId: string): Promise<AdminMenu> {
    return this.admin.menu(staff, brandId);
  }

  @Post('categories')
  @StaffRoute(...EDITORS)
  createCategory(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Body() body: CreateCategoryDto,
  ): Promise<AdminMenu> {
    return this.admin.createCategory(staff, brandId, body);
  }

  @Post('categories/reorder')
  @StaffRoute(...EDITORS)
  reorderCategories(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Body() body: ReorderDto,
  ): Promise<AdminMenu> {
    return this.admin.reorderCategories(staff, brandId, body.ids);
  }

  @Patch('categories/:categoryId')
  @StaffRoute(...EDITORS)
  updateCategory(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<AdminMenu> {
    return this.admin.updateCategory(staff, brandId, categoryId, body);
  }

  @Delete('categories/:categoryId')
  @StaffRoute(...EDITORS)
  deleteCategory(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('categoryId') categoryId: string,
  ): Promise<AdminMenu> {
    return this.admin.deleteCategory(staff, brandId, categoryId);
  }

  @Post('categories/:categoryId/items/reorder')
  @StaffRoute(...EDITORS)
  reorderItems(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: ReorderDto,
  ): Promise<AdminMenu> {
    return this.admin.reorderItems(staff, brandId, categoryId, body.ids);
  }

  @Post('items')
  @StaffRoute(...EDITORS)
  createItem(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Body() body: CreateItemDto,
  ): Promise<AdminMenu> {
    return this.admin.createItem(staff, brandId, body);
  }

  @Patch('items/:itemId')
  @StaffRoute(...EDITORS)
  updateItem(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('itemId') itemId: string,
    @Body() body: UpdateItemDto,
  ): Promise<AdminMenu> {
    return this.admin.updateItem(staff, brandId, itemId, body);
  }

  @Delete('items/:itemId')
  @StaffRoute(...EDITORS)
  deleteItem(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('itemId') itemId: string,
  ): Promise<AdminMenu> {
    return this.admin.deleteItem(staff, brandId, itemId);
  }

  @Post('items/:itemId/image')
  @StaffRoute(...EDITORS)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Sube o reemplaza la foto del producto (se achica a 800 px).' })
  async uploadImage(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('itemId') itemId: string,
    @Req() request: FastifyRequest,
  ): Promise<AdminMenu> {
    const upload = await readUpload(request);

    return this.admin.setItemImage(staff, brandId, itemId, upload.buffer);
  }

  @Delete('items/:itemId/image')
  @StaffRoute(...EDITORS)
  removeImage(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('itemId') itemId: string,
  ): Promise<AdminMenu> {
    return this.admin.removeItemImage(staff, brandId, itemId);
  }

  @Patch('items/:itemId/availability')
  @StaffRoute('owner', 'manager', 'cashier', 'kitchen')
  @ApiOperation({ summary: 'Agotar o devolver un producto. También lo hace la cocina.' })
  itemAvailability(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('itemId') itemId: string,
    @Body() body: AvailabilityDto,
  ): Promise<AdminMenu> {
    return this.admin.setItemAvailability(staff, brandId, itemId, body.available);
  }

  @Post('groups')
  @StaffRoute(...EDITORS)
  createGroup(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Body() body: GroupDto,
  ): Promise<AdminMenu> {
    return this.admin.createGroup(staff, brandId, body);
  }

  @Patch('groups/:groupId')
  @StaffRoute(...EDITORS)
  updateGroup(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('groupId') groupId: string,
    @Body() body: GroupDto,
  ): Promise<AdminMenu> {
    return this.admin.updateGroup(staff, brandId, groupId, body);
  }

  @Delete('groups/:groupId')
  @StaffRoute(...EDITORS)
  deleteGroup(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('groupId') groupId: string,
  ): Promise<AdminMenu> {
    return this.admin.deleteGroup(staff, brandId, groupId);
  }

  @Patch('groups/:groupId/modifiers/:modifierId/availability')
  @StaffRoute('owner', 'manager', 'cashier', 'kitchen')
  @ApiOperation({ summary: 'Agotar o devolver una opción ("se acabó la tocineta").' })
  modifierAvailability(
    @Staff() staff: StaffContext,
    @Param('brandId') brandId: string,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @Body() body: AvailabilityDto,
  ): Promise<AdminMenu> {
    return this.admin.setModifierAvailability(staff, brandId, groupId, modifierId, body.available);
  }
}
