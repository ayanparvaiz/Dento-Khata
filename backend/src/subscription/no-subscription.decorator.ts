import { SetMetadata } from '@nestjs/common';

export const NO_SUB_KEY = 'noSubscription';

// Marks a route as exempt from the subscription paywall (e.g. viewing status, submitting a payment).
export const NoSubscription = () => SetMetadata(NO_SUB_KEY, true);
