import { useState } from 'react';
import { api } from '@/lib/api';
import { useDrugs, usePrescriptions, useRxMutations, type RxItem } from '@/lib/clinical';
import { splitList, fmtDate } from '@/lib/format';
import type { Patient } from '@/lib/patients';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Plus, Printer, Trash2 } from 'lucide-react';

const DOSAGES = ['1+0+1', '1+1+1', '1+0+0', '0+0+1', '1+1+1+1', 'SOS'];

async function printRx(patient: Patient, diagnosis: string, advice: string, items: RxItem[]) {
  const s = (await api.get('/settings')).data;
  const rows = items
    .map((i) => `<tr><td><b>${i.drugName}</b>${i.generic ? `<br><span style="color:#64748b;font-size:12px">${i.generic}</span>` : ''}</td><td>${i.dosage}</td><td>${i.duration || ''}</td><td>${i.instruction || ''}</td></tr>`)
    .join('');
  const html = `<html><head><title>Prescription</title><style>
    body{font-family:sans-serif;padding:24px;color:#0f172a}
    .hd{border-bottom:2px solid #0f766e;padding-bottom:8px;margin-bottom:8px}
    h1{margin:0;color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:12px}
    td,th{border-bottom:1px solid #e2e8f0;padding:6px;text-align:left;font-size:14px}
    .rx{font-size:28px;color:#0f766e;font-weight:700}.muted{color:#64748b;font-size:12px}</style></head>
    <body><div class="hd"><h1>${s.name || 'Dental Clinic'}</h1>
    <div class="muted">${s.address || ''} ${s.phone ? '· ' + s.phone : ''}</div>
    ${s.letterhead ? `<div>${s.letterhead}</div>` : ''}</div>
    <div><b>${patient.fullName}</b> (${patient.code}) · ${patient.gender || ''} ${patient.phone || ''}</div>
    <div class="muted">Date: ${new Date().toLocaleDateString('en-GB')}</div>
    ${diagnosis ? `<p><b>Diagnosis:</b> ${diagnosis}</p>` : ''}
    <div class="rx">℞</div>
    <table><thead><tr><th>Medicine</th><th>Dosage</th><th>Duration</th><th>Instruction</th></tr></thead><tbody>${rows}</tbody></table>
    ${advice ? `<p><b>Advice:</b> ${advice}</p>` : ''}
    <p style="margin-top:48px;text-align:right">_____________________<br/>Signature</p>
    </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}

export function PrescriptionsTab({ patient }: { patient: Patient }) {
  const patientId = patient.id;
  const { data: history = [] } = usePrescriptions(patientId);
  const m = useRxMutations(patientId);

  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [items, setItems] = useState<(RxItem & { generic?: string })[]>([]);
  // Typeahead drug search (only queries when ≥2 chars — avoids loading all 8,900 drugs).
  const [query, setQuery] = useState('');
  const { data: results = [] } = useDrugs(query.length >= 2 ? query : '__none__');
  const [picked, setPicked] = useState<{ id: string; name: string; generic?: string; strength?: string } | null>(null);
  const [opts, setOpts] = useState({ dosage: '1+0+1', duration: '7 days', instruction: 'After meal' });

  // Group search results by generic so same-generic ALTERNATIVES sit together.
  const grouped = Object.entries(
    (query.length >= 2 ? results : []).reduce<Record<string, typeof results>>((acc, d) => {
      const g = d.generic || 'Other';
      (acc[g] ||= []).push(d);
      return acc;
    }, {}),
  );

  const allergens = splitList(patient.medicalHistory?.allergies);
  const allergyHits = items.filter((it) => {
    const hay = `${it.drugName} ${it.generic || ''}`.toLowerCase();
    return allergens.some((a) => a && hay.includes(a.toLowerCase()));
  });

  const addItem = () => {
    if (!picked) return;
    setItems([...items, {
      drugId: picked.id,
      drugName: `${picked.name}${picked.strength ? ' ' + picked.strength : ''}`,
      generic: picked.generic,
      dosage: opts.dosage, duration: opts.duration, instruction: opts.instruction,
    }]);
    setPicked(null);
    setQuery('');
  };

  const save = () => {
    if (items.length === 0) return;
    m.create.mutate(
      { diagnosis, advice, items },
      { onSuccess: () => { setItems([]); setDiagnosis(''); setAdvice(''); } },
    );
  };

  const sectionHead = 'mb-3 flex items-center gap-2 text-sm font-semibold text-foreground';
  const numChip = 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ---- Builder (left, wider) ---- */}
      <div className="space-y-4 lg:col-span-3">
        {/* 1. Diagnosis */}
        <Card>
          <CardContent className="pt-5">
            <div className={sectionHead}><span className={numChip}>1</span> Diagnosis</div>
            <Input placeholder="e.g. Acute pulpitis 36, Pericoronitis 48" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </CardContent>
        </Card>

        {/* 2. Add medicine */}
        <Card>
          <CardContent className="pt-5">
            <div className={sectionHead}><span className={numChip}>2</span> Add medicine</div>
            {picked ? (
              <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <span><b>{picked.name}</b> {picked.strength} — <span className="text-primary">{picked.generic}</span></span>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked(null)}>change</button>
              </div>
            ) : (
              <>
                <Input placeholder="Search brand or generic (e.g. Napa, Amoxicillin)…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query.length >= 2 && (
                  <div className="mt-1 max-h-60 overflow-auto rounded-md border border-border">
                    {grouped.length === 0 && <div className="p-3 text-xs text-muted-foreground">No match.</div>}
                    {grouped.map(([generic, list]) => (
                      <div key={generic}>
                        {/* generic group header = the alternatives bucket */}
                        <div className="sticky top-0 flex items-center justify-between bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                          <span>💊 {generic}</span>
                          {list.length > 1 && <span className="rounded-full bg-primary/15 px-2 text-primary">{list.length} alternatives</span>}
                        </div>
                        {list.map((d) => (
                          <button key={d.id} className="block w-full border-b border-border/40 px-3 py-1.5 text-left text-sm hover:bg-primary/10"
                            onClick={() => { setPicked({ id: d.id, name: d.name, generic: d.generic, strength: d.strength }); setQuery(''); }}>
                            <span className="font-medium">{d.name}</span> <span className="text-xs text-muted-foreground">{d.strength} · {d.form}</span>
                            <span className="block text-[11px] text-primary/80">{d.generic}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div><Label>Dosage</Label><Select value={opts.dosage} onChange={(e) => setOpts({ ...opts, dosage: e.target.value })}>{DOSAGES.map((d) => <option key={d}>{d}</option>)}</Select></div>
              <div><Label>Duration</Label><Input value={opts.duration} onChange={(e) => setOpts({ ...opts, duration: e.target.value })} /></div>
              <div><Label>Instruction</Label><Input value={opts.instruction} onChange={(e) => setOpts({ ...opts, instruction: e.target.value })} /></div>
            </div>
            <Button size="sm" className="mt-3 w-full" disabled={!picked} onClick={addItem}>
              <Plus className="h-4 w-4" /> Add to prescription
            </Button>
          </CardContent>
        </Card>

        {/* 3. Items added */}
        <Card>
          <CardContent className="pt-5">
            <div className={sectionHead}><span className={numChip}>3</span> Medicines ({items.length})</div>
            {allergyHits.length > 0 && (
              <div className="mb-2 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span><b>Allergy warning:</b> {allergyHits.map((h) => h.drugName).join(', ')} vs recorded allergies ({allergens.join(', ')}).</span>
              </div>
            )}
            {items.length === 0 && <p className="text-sm text-muted-foreground">No medicine added yet.</p>}
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <div>
                    <div className="font-medium">{it.drugName} <span className="font-normal text-primary">· {it.generic}</span></div>
                    <div className="text-xs text-muted-foreground">{it.dosage} · {it.duration} · {it.instruction}</div>
                  </div>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 4. Advice + actions */}
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className={sectionHead}><span className={numChip}>4</span> Advice &amp; finish</div>
            <Input placeholder="Advice (e.g. soft diet, warm saline rinse)" value={advice} onChange={(e) => setAdvice(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={save} disabled={items.length === 0 || m.create.isPending}>Save prescription</Button>
              <Button variant="outline" disabled={items.length === 0} onClick={() => printRx(patient, diagnosis, advice, items)}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- History (right) ---- */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Prescription history ({history.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {history.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
            {history.map((rx) => (
              <div key={rx.id} className="rounded-md border border-border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fmtDate(rx.createdAt)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => printRx(patient, rx.diagnosis || '', rx.advice || '', rx.items)} className="text-muted-foreground hover:text-primary"><Printer className="h-4 w-4" /></button>
                    <button onClick={() => m.remove.mutate(rx.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                {rx.diagnosis && <p className="text-sm font-medium">Dx: {rx.diagnosis}</p>}
                <ul className="mt-1 space-y-0.5 text-sm">
                  {rx.items.map((it, i) => (
                    <li key={i}>
                      • <b>{it.drugName}</b>{it.generic ? <span className="text-primary"> · {it.generic}</span> : ''}
                      <span className="text-muted-foreground"> — {it.dosage}{it.duration ? ` (${it.duration})` : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
