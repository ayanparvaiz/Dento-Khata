// Single source of truth for pricing on the frontend (mirrors backend subscription/plans.ts).
// Every screen — landing, paywall, subscribe page — reads from here so the discount
// (struck-through old price → new price) looks identical everywhere.

export const bn = (n: number) => n.toLocaleString('en-US').replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

export interface UIPlan {
  key: string;
  label: string;
  months: number;
  price: number; // current price
  oldPrice: number; // struck-through anchor
  days: number;
  best?: boolean;
}

export const PLANS: UIPlan[] = [
  { key: '1m', label: '১ মাস', months: 1, price: 490, oldPrice: 990, days: 30 },
  { key: '6m', label: '৬ মাস', months: 6, price: 2690, oldPrice: 5490, days: 180 },
  { key: '12m', label: '১২ মাস', months: 12, price: 4990, oldPrice: 9990, days: 365, best: true },
];

// ৳ per month (rounded) for the "৳X/মাস" sub-label.
export const perMonth = (p: UIPlan) => Math.round(p.price / p.months);

// Savings vs paying the 1-month price for the whole term (0 for the 1-month plan).
export const savings = (p: UIPlan) => {
  const base = PLANS[0].price * p.months;
  return Math.max(0, base - p.price);
};

export const planByKey = (k: string) => PLANS.find((p) => p.key === k) || PLANS[0];
