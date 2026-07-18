import { Module } from '@nestjs/common';
import { SuperAdminService } from './superadmin.service';
import { SuperAdminController } from './superadmin.controller';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SubscriptionModule, AuthModule],
  providers: [SuperAdminService],
  controllers: [SuperAdminController],
})
export class SuperAdminModule {}
