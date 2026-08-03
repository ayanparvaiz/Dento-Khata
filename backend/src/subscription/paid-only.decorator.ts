import { SetMetadata } from '@nestjs/common';

export const PAID_ONLY_KEY = 'paidOnly';

// Marks a route (or controller) as Pro-only. FREE-tier clinics get a 403 PAID_ONLY.
export const PaidOnly = () => SetMetadata(PAID_ONLY_KEY, true);
