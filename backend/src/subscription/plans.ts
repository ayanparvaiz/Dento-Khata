// Subscription package catalog — the single source of truth for pricing.
// The clinic picks one on the paywall; its price + duration drive the payment record,
// the operator alert, and (on verify) how many days of access are granted.
import { IS_OFFLINE } from '../config/mode';

export interface Plan {
  key: string;
  label: string; // Bangla label shown on the paywall
  months: number;
  price: number; // ৳ total for the term (current/effective price)
  oldPrice: number; // ৳ struck-through anchor price shown next to the new price
  days: number; // access days granted on verification
}

export const PLANS: Plan[] = [
  { key: '1m', label: '১ মাস', months: 1, price: 490, oldPrice: 990, days: 30 },
  { key: '6m', label: '৬ মাস', months: 6, price: 2690, oldPrice: 5490, days: 180 },
  { key: '12m', label: '১২ মাস', months: 12, price: 4990, oldPrice: 9990, days: 365 },
];

export const DEFAULT_PLAN = PLANS[0];

// Freemium model: every new clinic starts on FREE (forever, no trial, no paywall).
// A verified paid payment moves the plan to PAID for the purchased period.
export const FREE_PLAN = 'FREE';
export const PAID_PLAN = 'STANDARD';

// What the FREE tier is limited to (everything else is a Pro-only feature).
// plansPerPatient: a free clinic can keep ONE treatment plan per patient; multiple
// plans for the same patient is a Pro feature.
export const FREE_LIMITS = { patients: 100, users: 1, plansPerPatient: 1 };

// A subscription is "paid" (Pro) if it's on the paid plan and still within its period
// (+grace). Otherwise the clinic is on FREE — never blocked, just feature-limited.
// OFFLINE build is fully paid (one-time .exe) → always unlocked, no free/Pro split.
export function isPaidSub(sub: { plan?: string; currentPeriodEnd: Date | null } | null): boolean {
  if (IS_OFFLINE) return true;
  if (!sub) return false;
  const grace = (Number(process.env.SUBSCRIPTION_GRACE_DAYS) || 3) * 86_400_000;
  return !!(sub.plan === PAID_PLAN && sub.currentPeriodEnd && Date.now() <= sub.currentPeriodEnd.getTime() + grace);
}

export function planByKey(key?: string | null): Plan {
  return PLANS.find((p) => p.key === key) || DEFAULT_PLAN;
}
