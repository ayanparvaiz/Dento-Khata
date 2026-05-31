import { useState } from 'react';
import { api } from '@/lib/api';
import {
  useProcedures, useTreatment, useTreatmentMutations,
  type TreatmentPlan,
} from '@/lib/treatment';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Plus, Printer, Trash2 } from 'lucide-react';

const dt = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Bangladeshi Taka display.
function money(n: number) {
  return `৳${n.toLocaleString('en-IN')}`;
}
const num = (n: number) => n.toLocaleString('en-IN');

async function printEstimate(plan: TreatmentPlan, patientName: string) {
  const settings = (await api.get('/settings')).data;
  const rows = plan.items
    .map(
      (i, n) =>
        `<tr><td>${n + 1}</td><td>${i.procedure.name}</td><td>${i.toothNumber || '-'}</td><td>${i.status}</td><td style="text-align:right">${num(i.fee)}</td></tr>`,
    )
    .join('');
  const total = plan.items.reduce((s, i) => s + i.fee, 0);
  const html = `<html><head><title>Treatment Estimate</title>
    <style>body{font-family:sans-serif;padding:24px;color:#0f172a}
    h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;font-size:14px;text-align:left}
    .tot{text-align:right;font-weight:700;font-size:16px;margin-top:12px}</style></head>
    <body><h1>${settings.name || 'Dental Clinic'}</h1>
    <div>${settings.address || ''} ${settings.phone ? '· ' + settings.phone : ''}</div>
    <h2>Treatment Estimate</h2>
    <div><b>Patient:</b> ${patientName} &nbsp; <b>Plan:</b> ${plan.title || ''}</div>
    <table><thead><tr><th>#</th><th>Procedure</th><th>Tooth</th><th>Status</th><th style="text-align:right">Fee (${settings.currency || 'BDT'})</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div class="tot">Total: ${settings.currency || 'BDT'} ${num(total)}</div>
    <p style="margin-top:24px;font-size:12px;color:#64748b">This is an estimate. Final cost may vary.</p>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }
}

export function TreatmentTab({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { data: plans = [] } = useTreatment(patientId);
  const { data: procedures = [] } = useProcedures();
  const m = useTreatmentMutations(patientId);
  const [newTitle, setNewTitle] = useState('');

  return (
    <div className="space-y-4">
      {/* Create plan */}
      <Card>
        <CardContent className="pt-5">
          <Label>Create a new treatment plan</Label>
          <div className="flex items-end gap-2">
            <Input
              className="flex-1"
              placeholder="Plan title (e.g. Phase 1 — Restorative)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newTitle.trim()) { m.createPlan.mutate(newTitle); setNewTitle(''); } }}
            />
            <Button disabled={!newTitle.trim()} onClick={() => { m.createPlan.mutate(newTitle); setNewTitle(''); }}>
              <Plus className="h-4 w-4" /> Create plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {plans.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No treatment plans yet. Create one above to start adding procedures.</CardContent></Card>
      )}

      {plans.map((plan) => {
        const total = plan.items.reduce((s, i) => s + i.fee, 0);
        const done = plan.items.filter((i) => i.status === 'COMPLETED').reduce((s, i) => s + i.fee, 0);
        return (
          <Card key={plan.id}>
            <CardHeader className="flex-row items-center justify-between border-b border-border">
              <div>
                <CardTitle>{plan.title}</CardTitle>
                <div className="text-xs text-muted-foreground">Created {dt(plan.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => printEstimate(plan, patientName)}>
                  <Printer className="h-4 w-4" /> Print estimate
                </Button>
                <Button size="sm" variant="outline" onClick={() => { if (confirm(`Delete plan "${plan.title}" and all its procedures?`)) m.deletePlan.mutate(plan.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Procedures in this plan */}
              <div>
                <div className="mb-2 text-sm font-semibold">Procedures ({plan.items.length})</div>
                {plan.items.length === 0 && <p className="text-sm text-muted-foreground">No procedures yet — add one below.</p>}
                <div className="space-y-2">
                  {plan.items.map((i) => {
                    const doneRow = i.status === 'COMPLETED';
                    return (
                      <div key={i.id} className={cn('flex flex-wrap items-center gap-3 rounded-md border p-3', doneRow ? 'border-success/30 bg-success/5' : 'border-border')}>
                        <div className="min-w-[180px] flex-1">
                          <div className="font-medium">{i.procedure.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Tooth {i.toothNumber || '—'}
                            {doneRow && i.completedAt ? ` · ✓ done ${dt(i.completedAt)}` : ''}
                          </div>
                        </div>
                        <label className="flex items-center gap-1 text-sm">
                          <span className="text-muted-foreground">Fee ৳</span>
                          <input
                            type="number"
                            defaultValue={i.fee}
                            className="h-8 w-24 rounded-md border border-border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            onBlur={(e) => { const v = Number(e.target.value); if (v !== i.fee) m.updateItem.mutate({ itemId: i.id, fee: v }); }}
                          />
                        </label>
                        <Select
                          className={cn('h-8 w-36 text-xs font-medium', doneRow ? 'text-success' : 'text-amber-600')}
                          value={i.status}
                          onChange={(e) => m.updateItem.mutate({ itemId: i.id, status: e.target.value })}
                        >
                          <option value="PLANNED">PLANNED</option>
                          <option value="COMPLETED">COMPLETED ✓</option>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remove "${i.procedure.name}" from plan?`)) m.deleteItem.mutate(i.id); }}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add procedure — clearly separated input area */}
              <AddItemRow planId={plan.id} procedures={procedures} onAdd={(body) => m.addItem.mutate(body)} />

              <div className="flex justify-end gap-6 border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Completed: <b className="text-success">{money(done)}</b></span>
                <span>Total estimate: <b>{money(total)}</b></span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AddItemRow({
  planId, procedures, onAdd,
}: {
  planId: string;
  procedures: { id: string; name: string; defaultFee: number }[];
  onAdd: (body: any) => void;
}) {
  const [procedureId, setProcedureId] = useState('');
  const [tooth, setTooth] = useState('');
  const [fee, setFee] = useState(''); // staff types/confirms the fee

  const pickProcedure = (id: string) => {
    setProcedureId(id);
    const p = procedures.find((x) => x.id === id);
    setFee(p ? String(p.defaultFee) : ''); // prefill suggested fee, fully editable
  };

  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
      <div className="mb-2 text-sm font-semibold text-primary">➕ Add a procedure to this plan</div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Label>Procedure</Label>
          <Select value={procedureId} onChange={(e) => pickProcedure(e.target.value)}>
            <option value="">Select procedure…</option>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>{p.name} (suggested {money(p.defaultFee)})</option>
            ))}
          </Select>
        </div>
        <div className="w-20"><Label>Tooth</Label><Input value={tooth} onChange={(e) => setTooth(e.target.value)} /></div>
        <div className="w-28"><Label>Fee ৳</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
        <Button
          disabled={!procedureId}
          onClick={() => {
            onAdd({ planId, procedureId, toothNumber: tooth || undefined, fee: fee === '' ? undefined : Number(fee) });
            setProcedureId('');
            setTooth('');
            setFee('');
          }}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}
