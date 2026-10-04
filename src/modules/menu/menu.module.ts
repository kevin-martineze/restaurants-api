import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationModule } from '@modules/organization/organization.module';

import { PublicMenuController } from './controllers/public-menu.controller';
import { BranchItemsRepository } from './providers/branch-items.repository';
import { CategoriesRepository } from './providers/categories.repository';
import { ItemsRepository } from './providers/items.repository';
import { MenuPublisher } from './providers/menu-publisher.service';
import { MenuSnapshotsRepository } from './providers/menu-snapshots.repository';
import { ModifierGroupsRepository } from './providers/modifier-groups.repository';
import { PublicMenuService } from './providers/public-menu.service';
import { BranchItem, BranchItemSchema } from './schemas/branch-item.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Item, ItemSchema } from './schemas/item.schema';
import { MenuSnapshot, MenuSnapshotSchema } from './schemas/menu-snapshot.schema';
import { ModifierGroup, ModifierGroupSchema } from './schemas/modifier-group.schema';

@Module({
  imports: [
    OrganizationModule,
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Item.name, schema: ItemSchema },
      { name: ModifierGroup.name, schema: ModifierGroupSchema },
      { name: BranchItem.name, schema: BranchItemSchema },
      { name: MenuSnapshot.name, schema: MenuSnapshotSchema },
    ]),
  ],
  controllers: [PublicMenuController],
  providers: [
    CategoriesRepository,
    ItemsRepository,
    ModifierGroupsRepository,
    BranchItemsRepository,
    MenuSnapshotsRepository,
    MenuPublisher,
    PublicMenuService,
  ],
  exports: [
    CategoriesRepository,
    ItemsRepository,
    ModifierGroupsRepository,
    BranchItemsRepository,
    MenuSnapshotsRepository,
    MenuPublisher,
    PublicMenuService,
  ],
})
export class MenuModule {}
