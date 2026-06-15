import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DATABASE_CONFIG } from './config/database.config';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { AuthModule } from './modules/auth/auth.module';
import { ProductModule } from './modules/products/product.module';
import { OrderModule } from './modules/orders/order.module';
import { UserModule } from './modules/user/user.module';
import { BranchModule } from './modules/branch/branch.module';
import { POSDeviceModule } from './modules/pos-device/pos-device.module';
import { CustomerModule } from './modules/customer/customer.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { WalletTransactionModule } from './modules/wallet-transaction/wallet-transaction.module';
import { CategoryModule } from './modules/category/category.module';
import { OrderItemModule } from './modules/order-item/order-item.module';
import { PaymentModule } from './modules/payment/payment.module';
import { RefundModule } from './modules/refund/refund.module';
import { RefundItemModule } from './modules/refund-item/refund-item.module';
import { ShiftModule } from './modules/shift/shift.module';
import { CashMovementModule } from './modules/cash-movement/cash-movement.module';
import { StudentProfileModule } from './modules/student-profile/student-profile.module';
import { KitchenTicketModule } from './modules/kitchen-ticket/kitchen-ticket.module';
import { KitchenTicketItemModule } from './modules/kitchen-ticket-item/kitchen-ticket-item.module';
import { StockLevelModule } from './modules/stock-level/stock-level.module';
import { StockTransactionModule } from './modules/stock-transaction/stock-transaction.module';
import { InventoryItemModule } from './modules/inventory-item/inventory-item.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CartModule } from './modules/cart/cart.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { ParentModule } from './modules/parent/parent.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { WorkScheduleModule } from './modules/work-schedule/work-schedule.module';
import { SupplierModule } from './modules/supplier/supplier.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { SocketModule } from './modules/socket/socket.module';
import { FinanceModule } from './modules/finance/finance.module';
import { WarehouseVoucherModule } from './modules/warehouse-voucher/warehouse-voucher.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(DATABASE_CONFIG),
    AuthModule,
    UserModule,
    BranchModule,
    POSDeviceModule,
    CustomerModule,
    WalletModule,
    WalletTransactionModule,
    CategoryModule,
    ProductModule,
    OrderModule,
    OrderItemModule,
    PaymentModule,
    RefundModule,
    RefundItemModule,
    ShiftModule,
    CashMovementModule,
    StudentProfileModule,
    KitchenTicketModule,
    KitchenTicketItemModule,
    StockLevelModule,
    StockTransactionModule,
    InventoryItemModule,
    ReportsModule,
    CartModule,
    CouponModule,
    ParentModule,
    EmployeeModule,
    WorkScheduleModule,
    SupplierModule,
    PayrollModule,
    SocketModule,
    FinanceModule,
    WarehouseVoucherModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
