import { PrismaClient } from '@prisma/client';
import { currentStore } from '../tenant/tenant-context';
import { IS_OFFLINE } from '../config/mode';

// Models that carry a tenantId and MUST be isolated per tenant.
// NOT here (global): Tenant, SuperAdmin, Drug.
const TENANT_MODELS = new Set<string>([
  'User',
  'Patient',
  'MedicalHistory',
  'Appointment',
  'ToothRecord',
  'PerioRecord',
  'Procedure',
  'TreatmentPlan',
  'TreatmentRecord',
  'TreatmentItem',
  'ClinicalNote',
  'Prescription',
  'PrescriptionItem',
  'Invoice',
  'InvoiceItem',
  'Payment',
  'PatientFile',
  'ClinicSettings',
  'AuditLog',
  'Subscription',
  'SubscriptionPayment',
]);

const FILTER_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

// Recursively stamp tenantId on a create payload and any nested create/createMany.
// Every model we nest-create here is tenant-scoped (Drug is only ever `connect`ed), so this is safe.
function stampTenant(data: any, tid: string): any {
  if (Array.isArray(data)) return data.map((d) => stampTenant(d, tid));
  if (!data || typeof data !== 'object') return data;
  const out: any = { ...data, tenantId: tid };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('create' in v || 'createMany' in v) {
        const nv: any = { ...v };
        if (nv.create) nv.create = stampTenant(nv.create, tid);
        if (nv.createMany?.data) nv.createMany = { ...nv.createMany, data: stampTenant(nv.createMany.data, tid) };
        out[k] = nv;
      }
    }
  }
  return out;
}

// Build a PrismaClient extended with tenant isolation. The extension reads the per-request
// AsyncLocalStorage context at QUERY time, so a single shared client is safe.
// Offline SQLite: force a SINGLE serialized connection so concurrent requests never hit
// SQLite's DELETE-journal lock contention (which returns empty reads / SQLITE_BUSY). Combined
// with WAL + busy_timeout set right after connect, reads stay correct under concurrency.
function offlineSqliteUrl(): string | undefined {
  const url = process.env.DATABASE_URL || '';
  if (!IS_OFFLINE || !url.startsWith('file:')) return undefined;
  return url.includes('connection_limit=') ? url : url + (url.includes('?') ? '&' : '?') + 'connection_limit=1';
}

function buildClient() {
  const offlineUrl = offlineSqliteUrl();
  const base = new PrismaClient(offlineUrl ? { datasources: { db: { url: offlineUrl } } } : undefined);
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);

          const store = currentStore();
          if (store?.isSuperAdmin) return query(args); // cross-tenant operator

          const tenantId = store?.tenantId ?? null;
          // No tenant context (login/signup/seed): trust the caller's explicit tenantId.
          if (!tenantId) return query(args);

          const a: any = args || {};
          if (operation === 'create' || operation === 'createMany') {
            a.data = stampTenant(a.data, tenantId);
          } else if (operation === 'upsert') {
            a.create = stampTenant(a.create, tenantId);
            a.where = { ...(a.where || {}), tenantId };
          }
          if (FILTER_OPS.has(operation)) {
            a.where = { ...(a.where || {}), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

// Runtime type of the extended client (has all model delegates + $transaction etc.).
export type ExtendedPrisma = ReturnType<typeof buildClient>;

// PrismaService is injected as this token; the factory below returns the extended client.
// Kept as a class so existing constructors `private prisma: PrismaService` type-check
// against the PrismaClient surface (model delegates), while runtime adds tenant scoping.
export class PrismaService extends PrismaClient {}

export const PRISMA_FACTORY = {
  provide: PrismaService,
  useFactory: async () => {
    const client = buildClient();
    await (client as any).$connect();
    if (IS_OFFLINE) {
      // Per-connection SQLite pragmas — WAL enables concurrent readers with one writer,
      // busy_timeout waits on a lock instead of failing. With connection_limit=1 this one
      // connection carries them for every query.
      try {
        await (client as any).$executeRawUnsafe('PRAGMA journal_mode=WAL;');
        await (client as any).$executeRawUnsafe('PRAGMA busy_timeout=8000;');
        await (client as any).$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
      } catch { /* non-SQLite or pragma unsupported → ignore */ }
    }
    return client as unknown as PrismaService;
  },
};
