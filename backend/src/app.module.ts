import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { PatientsModule } from './patients/patients.module';
import { ChartingModule } from './charting/charting.module';
import { ProceduresModule } from './procedures/procedures.module';
import { TreatmentModule } from './treatment/treatment.module';
import { NotesModule } from './notes/notes.module';
import { DrugsModule } from './drugs/drugs.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { ImagingModule } from './imaging/imaging.module';
import { BillingModule } from './billing/billing.module';
import { ReportsModule } from './reports/reports.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SystemModule } from './system/system.module';
import { BackupModule } from './backup/backup.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionsGuard } from './auth/permissions.guard';
import { SubscriptionGuard } from './subscription/subscription.guard';
import { AuditInterceptor } from './audit/audit.interceptor';
import { TenantContextMiddleware } from './tenant/tenant-context.middleware';
import { SubscriptionModule } from './subscription/subscription.module';
import { SuperAdminModule } from './superadmin/superadmin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    PatientsModule,
    ChartingModule,
    ProceduresModule,
    TreatmentModule,
    NotesModule,
    DrugsModule,
    PrescriptionsModule,
    ImagingModule,
    BillingModule,
    ReportsModule,
    AppointmentsModule,
    SystemModule,
    BackupModule,
    SubscriptionModule,
    SuperAdminModule,
  ],
  controllers: [AppController],
  providers: [
    // Global: every route requires a valid JWT unless marked @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global: enforce per-assistant capability on routes marked @Requires(...).
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Global: block tenant routes when the subscription is inactive/expired.
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    // Global: record mutating requests for audit.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Open the tenant AsyncLocalStorage context on every request (before guards).
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
