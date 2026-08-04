// App run-mode. ONE codebase, two builds:
//   online  (default) — PostgreSQL, multi-tenant SaaS, subscription/Pro gating, cloud.
//   offline           — SQLite, single clinic, license-gated, everything unlocked (fully paid .exe).
//
// Defaults to 'online' so the live SaaS build is never affected unless APP_MODE=offline is set
// explicitly (by the desktop/.exe build). Everything offline-specific keys off IS_OFFLINE.
export type AppMode = 'online' | 'offline';

export const APP_MODE: AppMode = process.env.APP_MODE === 'offline' ? 'offline' : 'online';
export const IS_OFFLINE = APP_MODE === 'offline';
export const IS_ONLINE = !IS_OFFLINE;

// Case-insensitive string search: Postgres needs `mode: 'insensitive'`; SQLite's LIKE is
// already case-insensitive for ASCII and REJECTS the `mode` key — so omit it offline.
// Usage:  { name: { contains: q, ...INSENSITIVE } }
export const INSENSITIVE = IS_OFFLINE ? {} : ({ mode: 'insensitive' } as const);
