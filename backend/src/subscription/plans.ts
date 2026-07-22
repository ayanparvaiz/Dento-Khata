// Subscription package catalog — the single source of truth for pricing.
// The clinic picks one on the paywall; its price + duration drive the payment record,
// the operator alert, and (on verify) how many days of access are granted.
export interface Plan {
  key: string;
  label: string; // Bangla label shown on the paywall
  months: number;
  price: number; // ৳ total for the term
  days: number; // access days granted on verification
}

export const PLANS: Plan[] = [
  { key: '1m', label: '১ মাস', months: 1, price: 1990, days: 30 },
  { key: '6m', label: '৬ মাস', months: 6, price: 10990, days: 180 },
  { key: '12m', label: '১২ মাস', months: 12, price: 19990, days: 365 },
];

export const DEFAULT_PLAN = PLANS[0];

// Every new clinic starts on an automatic free trial of this many days.
export const TRIAL_DAYS = 3;
export const TRIAL_PLAN = 'TRIAL';

export function planByKey(key?: string | null): Plan {
  return PLANS.find((p) => p.key === key) || DEFAULT_PLAN;
}
