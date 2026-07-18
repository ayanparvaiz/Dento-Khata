# Multi-Vendor (SaaS) Plan — Dental Manager

Goal: sell this app to **many clinics/doctors**. Each is a **tenant** with fully **isolated data**.
Charge **৳990/month** per tenant. Branch: `multi-vendor` (the SQLite single-clinic build stays on `main`).

---

## 1. Multi-tenancy model — **shared Postgres DB + row-level `tenantId`**

Three ways to isolate tenants:

| Approach | Isolation | Cost/ops | Verdict |
|---|---|---|---|
| DB per tenant | Strongest | Heavy (N databases, N migrations) | ❌ overkill now |
| Schema per tenant | Strong | Medium (N schemas) | ❌ later, if needed |
| **Row-level `tenantId`** | Good (enforced in code) | **1 DB, 1 migration set** | ✅ **chosen** |

- Add a **`Tenant`** table (the clinic account).
- Add **`tenantId`** column to every tenant-scoped table (Patient, Appointment, TreatmentPlan, Prescription, Payment, Drug?, Procedure?, ClinicSettings, User, …).
- **Prisma middleware** auto-injects `tenantId` on every create and auto-filters every read/update/delete by the current request's tenant → no query can leak across tenants even if a dev forgets.
- Request → JWT carries `tenantId` → set on an AsyncLocalStorage context → middleware reads it.

**Global vs per-tenant data:**
- Global (shared, read-only): the 8,900-drug catalog, default procedure list → keep `tenantId = null` = template; on tenant signup, either share globally or clone. Recommendation: **drugs global/shared**, **procedures cloned per tenant** (they edit fees).
- Per-tenant: everything clinical + settings + users + subscription.

---

## 2. Auth & signup

- **Tenant signup flow:** clinic name + owner name + email/phone + password → creates `Tenant` + first `User` (role OWNER/ADMIN) + a trial subscription.
- Users belong to exactly one tenant (`User.tenantId`). Existing role system (ADMIN/ASSISTANT + capabilities) stays, scoped inside the tenant.
- Add role **OWNER** (billing + everything) above ADMIN.
- JWT payload gains `tenantId`.
- A **super-admin** (you) area: list tenants, their subscription status, activate/suspend, see MRR. Separate from tenant data.

---

## 3. Subscription & billing (৳990/mo) — **the bKash / no-trade-license reality**

**Honest constraint:** bKash's official **merchant APIs** (Checkout / **Tokenized Checkout "Agreement" = auto-debit recurring**) require a **registered business**: trade license + TIN + company bank account. **Without a trade license you cannot get true auto-recurring bKash.**

Realistic options:

| Option | Auto-debit? | Onboarding | Notes |
|---|---|---|---|
| **bKash Merchant (Tokenized/Agreement)** | ✅ auto | needs trade license + bank | the "proper" way — later |
| **Aggregator: SSLCommerz / aamarPay / ShurjoPay** | ✅ (recurring/EMI) | some onboard **sole proprietor** (NID + bank, sometimes lighter than trade license) | fastest legit path to recurring |
| **bKash Personal + manual verify** | ❌ manual monthly | none | user sends ৳990 to your personal bKash w/ a reference code → you (or a rule) confirm → +30 days |

**Recommended phased approach (gateway-agnostic):**
1. **Build a provider-agnostic subscription core** now:
   - `Subscription { tenantId, plan, status: TRIAL|ACTIVE|PAST_DUE|SUSPENDED, currentPeriodEnd, ... }`
   - `SubscriptionPayment { tenantId, amount, method, ref, paidAt, verifiedBy }`
   - A **subscription guard**: if `status` not ACTIVE/TRIAL or `currentPeriodEnd < now (+grace)` → block the app (read-only or paywall), show "renew" screen.
2. **Phase 1 — Manual bKash (launch without trade license):** tenant sees "Send ৳990 to 01XXXXXXXXX (reference: TENANT-CODE)"; enters the bKash TrxID; you verify in super-admin (or auto-verify later) → extend 30 days. Ships immediately, zero paperwork.
3. **Phase 2 — Aggregator recurring:** integrate SSLCommerz/aamarPay once you register (even as proprietor) → auto monthly debit, webhooks flip `status`/extend period. The core + guard don't change, only the provider adapter.
4. **Phase 3 — bKash Tokenized auto-debit** when you have a trade license.

> Decision needed from you: start with **Phase 1 (manual bKash)** to launch now, or wait and go straight to an **aggregator** (need NID/bank onboarding)?

---

## 4. Postgres migration (Prisma makes it light)

- `datasource db { provider = "postgresql" }` + `DATABASE_URL=postgres://…`.
- Prisma models are 95% portable; SQLite-only hacks to revisit: JSON-as-string fields (allergies, examGrid, pocketDepth) can become real `Json`; `@default` fine. Enums can become real Postgres enums (optional).
- **New branch = fresh migration history** (`migrations/` reset for Postgres). `main` keeps SQLite migrations untouched.
- Local dev: Postgres via Docker (`postgres:16`) or a local install. VPS: managed or self-hosted Postgres + daily `pg_dump` backups (replaces the SQLite VACUUM backup).
- Data-safety design (auto-backup/restore) re-implemented for Postgres (pg_dump/pg_restore, off-box copy).

---

## 5. Data isolation & security (must-get-right)

- Prisma middleware scoping is the primary guard; add **defense-in-depth**: every service also takes `tenantId` explicitly for sensitive queries.
- Never trust a `tenantId` from the request body — only from the **verified JWT**.
- Uploads (x-rays, logo) namespaced by tenant: `/uploads/<tenantId>/…`.
- Backups per tenant on request (export only their rows).
- Rate-limit + audit log already exists — scope per tenant.

---

## 6. Deployment

- VPS already runs the app (pm2 + nginx). Add **Postgres** on the same box (or managed).
- Same domain can serve all tenants (they log in to their own data) — **subdomain per tenant optional later** (clinic.dentist.app).
- Env: `DATABASE_URL`, `JWT_SECRET`, bKash/aggregator keys, super-admin creds.
- The `deploy/deploy.sh` gets a Postgres-aware variant on this branch.

---

## 7. Rough roadmap (build order)

1. Postgres switch + Docker dev DB (branch bootstrap).
2. `Tenant` model + `tenantId` on all models + Prisma tenant middleware + AsyncLocalStorage context.
3. Tenant signup + OWNER role + JWT `tenantId` + super-admin console.
4. Subscription core + subscription guard (paywall) + **Phase-1 manual bKash**.
5. Per-tenant uploads + backups; migrate seed → per-tenant clone.
6. (Later) aggregator recurring; subdomains; usage limits.

---

## 8. Decisions — LOCKED (2026-07-18)

1. **Billing path:** ✅ **Manual bKash (Phase 1)** now. Aggregator later, core stays gateway-agnostic.
2. **Postgres hosting:** ✅ **Self-host on the VPS** now → move to managed when user count grows. **Daily DB backup** (pg_dump) copied to an off-box storage (destination TBD by user).
3. **Tenant access model:** ✅ **One shared login domain**, single subdomain (no per-clinic subdomains).
4. **Drug catalog:** ✅ **Shared-global** for all tenants.
5. **Trial:** ✅ **No automatic free trial.** Instead the **super-admin grants access manually** for an arbitrary number of days (3/7/any) so a clinic can try it. → Subscription core must support an admin "grant N days" action that sets/extends `currentPeriodEnd` and flips status ACTIVE, any day count.

> Approved. Build order = Section 7 roadmap, starting Postgres switch + Tenant model on this `multi-vendor` branch.
