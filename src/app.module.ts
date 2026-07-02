import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { CustomersModule } from './customers/customers.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SettingsModule } from './settings/settings.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { LedgerModule } from './ledger/ledger.module';
import { CalendarModule } from './calendar/calendar.module';
import { VisitModule } from './visit/visit.module';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    AuthModule,
    WorkspaceModule,
    PrismaModule,
    TasksModule,
    CustomersModule,
    PrescriptionsModule,
    HealthModule,
    OrdersModule,
    DashboardModule,
    NotificationsModule,
    AppointmentsModule,
    SettingsModule,
    ExpensesModule,
    SuppliersModule,
    PurchasesModule,
    LedgerModule,
    CalendarModule,
    VisitModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
