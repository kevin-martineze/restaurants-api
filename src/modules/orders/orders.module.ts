import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersModule } from '@modules/customers/customers.module';
import { MenuModule } from '@modules/menu/menu.module';
import { OrganizationModule } from '@modules/organization/organization.module';

import { PanelOrdersController } from './controllers/panel-orders.controller';
import { PublicOrdersController } from './controllers/public-orders.controller';
import { CheckoutService } from './providers/checkout.service';
import { OrderBoardService } from './providers/order-board.service';
import { OrderEventsBus } from './providers/order-events.bus';
import { OrderCountersRepository } from './providers/order-counters.repository';
import { OrdersRepository } from './providers/orders.repository';
import { OrderCounter, OrderCounterSchema } from './schemas/order-counter.schema';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MenuModule,
    CustomersModule,
    OrganizationModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderCounter.name, schema: OrderCounterSchema },
    ]),
  ],
  controllers: [PublicOrdersController, PanelOrdersController],
  providers: [
    OrdersRepository,
    OrderCountersRepository,
    CheckoutService,
    OrderBoardService,
    OrderEventsBus,
  ],
  exports: [OrdersRepository, OrderCountersRepository, OrderEventsBus],
})
export class OrdersModule {}
