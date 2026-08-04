// Frontend build mode. The offline (.exe) build is compiled with VITE_APP_MODE=offline,
// which hides the SaaS-only UI (subscription/upgrade, marketing signup landing) — the
// offline app is fully paid, so there is no free/Pro split or paywall.
export const IS_OFFLINE = import.meta.env.VITE_APP_MODE === 'offline';
export const IS_ONLINE = !IS_OFFLINE;
