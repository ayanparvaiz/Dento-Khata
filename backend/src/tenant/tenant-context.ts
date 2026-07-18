import { AsyncLocalStorage } from 'async_hooks';

// Per-request tenant context. Set by TenantContextMiddleware from the verified JWT,
// read by the Prisma tenant middleware to scope every query. Never populated from the body.
export interface TenantStore {
  tenantId: string | null;
  userId: string | null;
  role: string | null;
  isSuperAdmin: boolean;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function currentStore(): TenantStore | undefined {
  return tenantStorage.getStore();
}

export function currentTenantId(): string | null {
  return tenantStorage.getStore()?.tenantId ?? null;
}

export function isSuperAdminCtx(): boolean {
  return tenantStorage.getStore()?.isSuperAdmin === true;
}

// Run a callback in an explicit tenant context (used by signup/seed where there is no request JWT).
export function runInTenant<T>(tenantId: string | null, fn: () => T, opts?: Partial<TenantStore>): T {
  return tenantStorage.run(
    { tenantId, userId: null, role: null, isSuperAdmin: false, ...opts },
    fn,
  );
}
