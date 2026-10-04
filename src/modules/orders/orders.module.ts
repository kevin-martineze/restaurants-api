import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomersModule } from '@modules/customers/customers.module';
import { MenuModule } from '@modules/menu/menu.module';

import { PublicOrdersController } from './controllers/public-orders.controller';
import { CheckoutService } from './providers/checkout.service';
import { OrderCountersRepository } from './providers/order-counters.repository';
import { OrdersRepository } from './providers/orders.repository';
import { OrderCounter, OrderCounterSchema } from './schemas/order-counter.schema';
import { Order, OrderSchema } from './schemas/order.schema';

@Module({
  imports: [
    MenuModule,
    CustomersModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: OrderCounter.name, schema: OrderCounterSchema },
    ]),
  ],
  controllers: [PublicOrdersController],
  providers: [OrdersRepository, OrderCountersRepository, CheckoutService],
  exports: [OrdersRepository],
})
export class OrdersModule {}
