import { api } from '@/lib/api';
import { TreatmentTab } from '@/components/TreatmentTab';
import { BillingTab } from '@/components/BillingTab';
import { useTreatment, useTreatmentRecords } from '@/lib/treatment';
import { useLedger, usePayments } from '@/lib/clinical';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import type { Patient } from '@/lib/patients';

const num = (n: number) => (n || 0).toLocaleString('en-IN');
const dDate = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

// Full patient statement: clinic header → per treatment-plan (items + dated visit log)
// → payments → totals. Built live from current data (no stored copy), then printed.
async function printStatement(patient: Patient, plans: any[], records: any[], payments: any[], ledger: any) {
  const s = (await api.get('/settings')).data;
  const cur = s.currency || 'BDT';

  const planBlocks = plans.map((pl) => {
    const items = pl.items
      .map((i: any, n: number) =>
        `<tr><td>${n + 1}</td><td>${i.procedure?.name ?? ''}</td><td>${i.toothNumber || '-'}</td><td>${i.status}${i.completedAt ? ' · ' + dDate(i.completedAt) : ''}</td><td style="text-align:right">${num(i.fee)}</td></tr>`)
      .join('');
    const subtotal = pl.items.reduce((a: number, i: any) => a + i.fee, 0);
    const recs = records.filter((r) => r.planId === pl.id);
    const visitRows = recs.length
      ? `<table class="log"><thead><tr><th style="width:110px">Visit date</th><th>Treatment record</th></tr></thead><tbody>${recs
          .map((r) => `<tr><td>${dDate(r.visitDate)}</td><td>${r.content}</td></tr>`).join('')}</tbody></table>`
      : '';
    return `<div class="plan"><h3>${pl.title || 'Treatment plan'} <span class="badge">${pl.status}</span></h3>
      <table><thead><tr><th>#</th><th>Procedure</th><th>Tooth</th><th>Status</th><th style="text-align:right">Fee (${cur})</th></tr></thead>
      <tbody>${items || '<tr><td colspan=5 style="color:#94a3b8">No procedures</td></tr>'}</tbody></table>
      <div class="sub">Plan subtotal: ${cur} ${num(subtotal)}</div>
      ${visitRows ? `<div class="logwrap"><div class="logh">Visit log</div>${visitRows}</div>` : ''}
    </div>`;
  }).join('');

  const otherRecs = records.filter((r) => !r.planId);
  const otherBlock = otherRecs.length
    ? `<div class="plan"><h3>Other visits</h3><table class="log"><thead><tr><th style="width:110px">Date</th><th>Treatment record</th></tr></thead><tbody>${otherRecs
        .map((r) => `<tr><td>${dDate(r.visitDate)}</td><td>${r.content}</td></tr>`).join('')}</tbody></table></div>`
    : '';

  const payRows = payments
    .map((p) => `<tr><td>${dDate(p.paidAt)}</td><td>${p.method}</td><td>${p.note || ''}</td><td style="text-align:right">${num(p.amount)}</td></tr>`)
    .join('');

  const age = patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.15576e10) + ' yr' : '';
  const html = `<html><head><title>Patient statement — ${patient.fullName}</title><style>
    body{font-family:system-ui,sans-serif;padding:28px;color:#0f172a}
    .top{display:flex;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:8px}
    h1{margin:0;color:#0f766e;font-size:22px} .muted{color:#64748b;font-size:12px}
    .pinfo{margin:14px 0;font-size:14px} .pinfo b{color:#0f172a}
    .plan{margin:16px 0;page-break-inside:avoid} h3{margin:0 0 6px;font-size:15px}
    .badge{font-size:11px;background:#e2e8f0;border-radius:10px;padding:1px 8px;color:#475569;font-weight:600}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th,td{border:1px solid #e2e8f0;padding:5px 8px;font-size:13px;text-align:left}
    th{background:#f8fafc} .sub{text-align:right;font-weight:600;margin-top:4px;font-size:13px}
    .logwrap{margin-top:6px} .logh{font-size:12px;font-weight:600;color:#475569} .log th,.log td{font-size:12px}
    .totals{margin-top:18px;border-top:2px solid #0f766e;padding-top:10px;text-align:right;font-size:14px}
    .totals .bal{font-size:18px;font-weight:800}
    @media print{button{display:none}}</style></head><body>
    <div class="top"><div><h1>${s.name || 'Dental Clinic'}</h1><div class="muted">${s.address || ''} ${s.phone ? '· ' + s.phone : ''}</div></div>
    <div class="muted" style="text-align:right">Statement<br/>${dDate(new Date().toISOString())}</div></div>
    <div class="pinfo"><b>${patient.fullName}</b> &nbsp; <span class="muted">${patient.code}</span><br/>
    ${patient.gender || ''} ${age ? '· ' + age : ''} ${patient.phone ? '· ' + patient.phone : ''}</div>
    <h2 style="font-size:16px">Treatment &amp; account statement</h2>
    ${planBlocks || '<p class="muted">No treatment plans.</p>'}
    ${otherBlock}
    <h3 style="margin-top:18px">Payments received</h3>
    <table><thead><tr><th>Date</th><th>Method</th><th>Note</th><th style="text-align:right">Amount (${cur})</th></tr></thead>
    <tbody>${payRows || '<tr><td colspan=4 style="color:#94a3b8">No payments yet</td></tr>'}</tbody></table>
    <div class="totals">
      Total treatment cost: ${cur} ${num(ledger?.total || 0)}<br/>
      Paid: ${cur} ${num(ledger?.paid || 0)}<br/>
      <span class="bal">Balance due: ${cur} ${num(ledger?.balance || 0)}</span>
    </div>
    <p class="muted" style="margin-top:24px">Generated by ${s.name || 'Dental Manager'} · Thank you.</p>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}

// One tab: plan procedures (total = the charge/due) → collect payment in installments below.
export function TreatmentBillingTab({ patient }: { patient: Patient }) {
  const { data: plans = [] } = useTreatment(patient.id);
  const { data: records = [] } = useTreatmentRecords(patient.id);
  const { data: payments = [] } = usePayments(patient.id);
  const { data: ledger } = useLedger(patient.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Treatment plan</h2>
        <Button size="sm" variant="outline" onClick={() => printStatement(patient, plans, records, payments, ledger)}>
          <Printer className="mr-1.5 h-4 w-4" /> Print statement
        </Button>
      </div>
      <section>
        <TreatmentTab patientId={patient.id} patientName={patient.fullName} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Account &amp; payments</h2>
        <BillingTab patient={patient} />
      </section>
    </div>
  );
}
