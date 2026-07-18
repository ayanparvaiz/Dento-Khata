import { Body, Controller, Get, Post } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubmitPaymentDto } from './dto';
import { NoSubscription } from './no-subscription.decorator';

// Tenant self-service billing. Exempt from the paywall so a blocked clinic can still pay.
@Controller('subscription')
@NoSubscription()
export class SubscriptionController {
  constructor(private subs: SubscriptionService) {}

  @Get()
  status() {
    return this.subs.myStatus();
  }

  @Post('pay')
  pay(@Body() dto: SubmitPaymentDto) {
    return this.subs.submitPayment(dto);
  }
}
