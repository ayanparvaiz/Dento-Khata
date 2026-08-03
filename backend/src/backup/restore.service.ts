import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Duplicate-proof restore of a clinic JSON backup (produced by BackupService.exportTenantData).
//
// Identity is the internal cuid `id`, NEVER the human code (P-00001) — two different people
// can share a code across installs, but never an id. Rules per record:
//   • id already exists in this tenant  -> SKIP (no duplicate)
//   • id is new                         -> INSERT (keeping the original id so relations hold)
// Human codes/numbers that clash with a DIFFERENT existing record are re-assigned:
//   • Patient.code / Invoice.number     -> next free code (record kept, just renumbered)
//   • Procedure.code                    -> treated as the SAME catalog item -> merged (id remapped)
// Foreign keys pointing at rows that don't exist here (a doctor/user, a global drug, a
// procedure from another install) are nulled where the column is optional, so the restore
// never fails on a dangling reference. tenantId is always forced to the current tenant.
@Injectable()
export class RestoreService {
  constructor(private prisma: PrismaService) {}

  async restore(payload: any) {
    const d = payload?.data;
    if (!d || typeof d !== 'object' || !Array.isArray(d.patients)) {
      throw new BadRequestException('ব্যাকআপ ফাইলটি সঠিক নয় (data.patients পাওয়া যায়নি)।');
    }
    const arr = (x: any): any[] => (Array.isArray(x) ? x : []);
    // Strip fields we must not carry over. tenantId is re-stamped by the Prisma tenant
    // extension on create anyway; we drop it to be explicit.
    const clean = (row: any) => {
      const { tenantId, ...rest } = row || {};
      return rest;
    };

    return this.prisma.$transaction(async (tx) => {
      const t: any = tx;
      const summary: Record<string, { added: number; skipped: number; recoded?: number; merged?: number }> = {};

      // ---- preload existing ids (all tenant-scoped by the extension) ----
      const idSet = async (delegate: any): Promise<Set<string>> =>
        new Set((await delegate.findMany({ select: { id: true } })).map((r: any) => r.id));

      const patientIds = await idSet(t.patient);
      const userIds = await idSet(t.user);           // users are NOT in the backup; keep existing only
      const drugIds = new Set<string>((await t.drug.findMany({ select: { id: true } })).map((r: any) => r.id)); // global catalog

      // ===== 1) Patients — dedup by id; renumber code on clash =====
      const existingPatients = await t.patient.findMany({ select: { id: true, code: true } });
      const patientCodes = new Set(existingPatients.map((p: any) => p.code));
      let maxPatientNum = existingPatients.reduce((m: number, p: any) => {
        const n = parseInt(String(p.code).replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      const nextPatientCode = () => `P-${String(++maxPatientNum).padStart(5, '0')}`;

      summary.patients = { added: 0, skipped: 0, recoded: 0 };
      for (const raw of arr(d.patients)) {
        if (patientIds.has(raw.id)) { summary.patients.skipped++; continue; }
        const row = clean(raw);
        if (patientCodes.has(row.code)) { row.code = nextPatientCode(); summary.patients.recoded!++; }
        await t.patient.create({ data: row });
        patientIds.add(raw.id); patientCodes.add(row.code); summary.patients.added++;
      }

      // ===== 2) Procedures — merge by code (same code = same catalog item) =====
      const existingProcs = await t.procedure.findMany({ select: { id: true, code: true } });
      const procIds = new Set<string>(existingProcs.map((p: any) => p.id));
      const procByCode = new Map(existingProcs.map((p: any) => [p.code, p.id]));
      const procMap = new Map<string, string>(); // backup procedureId -> id to use here
      summary.procedures = { added: 0, skipped: 0, merged: 0 };
      for (const raw of arr(d.procedures)) {
        if (procIds.has(raw.id)) { procMap.set(raw.id, raw.id); summary.procedures.skipped++; continue; }
        const byCode = procByCode.get(raw.code);
        if (byCode) { procMap.set(raw.id, byCode as string); summary.procedures.merged!++; continue; }
        await t.procedure.create({ data: clean(raw) });
        procIds.add(raw.id); procByCode.set(raw.code, raw.id); procMap.set(raw.id, raw.id);
        summary.procedures.added++;
      }
      const mapProc = (v?: string | null) => (v == null ? null : procMap.get(v) ?? (procIds.has(v) ? v : null));

      // Generic id-dedup importer for simple children.
      // required: FK fields whose parent MUST exist (row skipped otherwise)
      // nullable: FK fields nulled when the referenced id is absent
      const importChild = async (
        rows: any[], delegate: any, name: string,
        opts: {
          required?: { field: string; known: Set<string> }[];
          nullable?: { field: string; known: Set<string> }[];
          transform?: (row: any) => void;
          skip?: (row: any) => boolean; // evaluated AFTER transform (e.g. required FK became null)
        } = {},
      ) => {
        const existing = await idSet(delegate);
        const s = { added: 0, skipped: 0 };
        for (const raw of arr(rows)) {
          if (existing.has(raw.id)) { s.skipped++; continue; }
          const row = clean(raw);
          let ok = true;
          for (const rp of opts.required || []) {
            if (row[rp.field] == null || !rp.known.has(row[rp.field])) { ok = false; break; }
          }
          if (!ok) { s.skipped++; continue; }
          for (const np of opts.nullable || []) {
            if (row[np.field] != null && !np.known.has(row[np.field])) row[np.field] = null;
          }
          opts.transform?.(row);
          if (opts.skip?.(row)) { s.skipped++; continue; }
          await delegate.create({ data: row });
          existing.add(raw.id); s.added++;
        }
        summary[name] = s;
        return existing;
      };

      // ===== 3) MedicalHistory — one per patient (patientId is unique) =====
      {
        const existing = await t.medicalHistory.findMany({ select: { id: true, patientId: true } });
        const mhIds = new Set(existing.map((r: any) => r.id));
        const mhPatients = new Set(existing.map((r: any) => r.patientId));
        const s = { added: 0, skipped: 0 };
        for (const raw of arr(d.medicalHistory)) {
          if (mhIds.has(raw.id) || mhPatients.has(raw.patientId) || !patientIds.has(raw.patientId)) { s.skipped++; continue; }
          await t.medicalHistory.create({ data: clean(raw) });
          mhIds.add(raw.id); mhPatients.add(raw.patientId); s.added++;
        }
        summary.medicalHistory = s;
      }

      // ===== 4) Appointments — patient required; dentist (User) nulled if absent =====
      const apptIds = await importChild(d.appointments, t.appointment, 'appointments', {
        required: [{ field: 'patientId', known: patientIds }],
        nullable: [{ field: 'dentistId', known: userIds }],
      });

      // ===== 5) Charting =====
      await importChild(d.toothRecords, t.toothRecord, 'toothRecords', { required: [{ field: 'patientId', known: patientIds }] });
      await importChild(d.perioRecords, t.perioRecord, 'perioRecords', { required: [{ field: 'patientId', known: patientIds }] });

      // ===== 6) Treatment plans -> items -> records =====
      const planIds = await importChild(d.treatmentPlans, t.treatmentPlan, 'treatmentPlans', { required: [{ field: 'patientId', known: patientIds }] });
      await importChild(d.treatmentItems, t.treatmentItem, 'treatmentItems', {
        required: [{ field: 'planId', known: planIds }],
        // procedureId is required; remap it, and skip the item if the procedure can't be resolved.
        transform: (row) => { row.procedureId = mapProc(row.procedureId); },
        skip: (row) => row.procedureId == null,
      });

      const treatmentRecordIds = await importChild(d.treatmentRecords, t.treatmentRecord, 'treatmentRecords', {
        required: [{ field: 'patientId', known: patientIds }],
        nullable: [{ field: 'planId', known: planIds }],
      });

      await importChild(d.clinicalNotes, t.clinicalNote, 'clinicalNotes', { required: [{ field: 'patientId', known: patientIds }] });

      // ===== 7) Prescriptions -> items =====
      const prescriptionIds = await importChild(d.prescriptions, t.prescription, 'prescriptions', {
        required: [{ field: 'patientId', known: patientIds }],
        nullable: [{ field: 'planId', known: planIds }],
      });
      await importChild(d.prescriptionItems, t.prescriptionItem, 'prescriptionItems', {
        required: [{ field: 'prescriptionId', known: prescriptionIds }],
        nullable: [{ field: 'drugId', known: drugIds }],
      });

      // ===== 8) Invoices — dedup by id; renumber `number` on clash =====
      const existingInvoices = await t.invoice.findMany({ select: { id: true, number: true } });
      const invoiceIds = new Set<string>(existingInvoices.map((r: any) => r.id));
      const invoiceNumbers = new Set(existingInvoices.map((r: any) => r.number));
      let maxInvNum = existingInvoices.reduce((m: number, r: any) => {
        const n = parseInt(String(r.number).replace(/\D/g, ''), 10);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 0);
      summary.invoices = { added: 0, skipped: 0, recoded: 0 };
      for (const raw of arr(d.invoices)) {
        if (invoiceIds.has(raw.id)) { summary.invoices.skipped++; continue; }
        if (!patientIds.has(raw.patientId)) { summary.invoices.skipped++; continue; }
        const row = clean(raw);
        if (invoiceNumbers.has(row.number)) { row.number = `INV-${String(++maxInvNum).padStart(5, '0')}`; summary.invoices.recoded!++; }
        await t.invoice.create({ data: row });
        invoiceIds.add(raw.id); invoiceNumbers.add(row.number); summary.invoices.added++;
      }

      await importChild(d.invoiceItems, t.invoiceItem, 'invoiceItems', {
        required: [{ field: 'invoiceId', known: invoiceIds }],
        transform: (row) => { row.procedureId = mapProc(row.procedureId); },
      });

      // ===== 9) Payments — all links optional; null any that don't resolve =====
      await importChild(d.payments, t.payment, 'payments', {
        nullable: [
          { field: 'patientId', known: patientIds },
          { field: 'appointmentId', known: apptIds },
          { field: 'treatmentRecordId', known: treatmentRecordIds },
          { field: 'invoiceId', known: invoiceIds },
        ],
      });

      // ===== 10) Patient files (metadata only; the image bytes live on disk) =====
      await importChild(d.files, t.patientFile, 'files', {
        required: [{ field: 'patientId', known: patientIds }],
        nullable: [{ field: 'appointmentId', known: apptIds }],
      });

      // ===== 11) Clinic settings — singleton; only restore if none exists (don't clobber) =====
      {
        const has = await t.clinicSettings.count();
        const s = { added: 0, skipped: 0 };
        const first = arr(d.settings)[0];
        if (!has && first) { await t.clinicSettings.create({ data: clean(first) }); s.added++; }
        else s.skipped = arr(d.settings).length;
        summary.clinicSettings = s;
      }

      const totals = Object.values(summary).reduce(
        (acc, v) => ({ added: acc.added + v.added, skipped: acc.skipped + v.skipped }),
        { added: 0, skipped: 0 },
      );
      return { ok: true, totals, summary };
    }, { timeout: 120_000 });
  }
}
