import { useState } from 'react';
import { api } from '@/lib/api';
import { useDrugs, usePrescriptions, useRxMutations, type RxItem } from '@/lib/clinical';
import { useTreatment } from '@/lib/treatment';
import { splitList, fmtDate, ageFromDob } from '@/lib/format';
import { letterheadHead, letterheadFoot, LETTERHEAD_CSS, themeOf } from '@/lib/letterhead';
import type { Patient } from '@/lib/patients';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { AlertTriangle, Plus, Printer, Trash2, Eye, Save } from 'lucide-react';

// English digits -> Bangla, and back
const bn = (s: string | number) => String(s).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[+x]);
const enDigits = (s: string) => s.replace(/[০-৯]/g, (x) => String('০১২৩৪৫৬৭৮৯'.indexOf(x)));
const DOSES = ['১+০+১', '১+১+১', '১+০+০', '০+০+১', '১+১+১+১', '০+০+০+১', 'প্রয়োজনে', '২ চামচ', '১ চামচ'];
const TIMINGS = ['খাবার পর', 'খাবার আগে', 'ভরা পেটে', 'খালি পেটে'];
const NUMS = Array.from({ length: 30 }, (_, i) => String(i + 1)); // 1–30

type Grid = { UR: string; UL: string; LR: string; LL: string };
type Draft = {
  dx: string; cc: string; oe: string; grid: Grid; ix: string; notes: string;
  advice: string; followNum: string; followUnit: string; planId: string;
};
const emptyDraft: Draft = {
  dx: '', cc: '', oe: '', grid: { UR: '', UL: '', LR: '', LL: '' }, ix: '', notes: '',
  advice: '', followNum: '', followUnit: 'দিন', planId: '',
};

async function printRx(patient: Patient, d: Draft, items: RxItem[], withHeader: boolean) {
  const s = (await api.get('/settings')).data;
  const c = themeOf(s);
  const age = patient.dateOfBirth ? ageFromDob(patient.dateOfBirth) : '';
  const meds = items.map((i, n) => {
    const parts = [i.dosage, i.timing, i.duration, i.instruction].filter(Boolean).map((p) => `<span>${p}</span>`).join('');
    return `<div class="med"><div class="nm"><b>${bn(n + 1)}. ${i.drugName}</b></div><div class="sub">${parts}</div></div>`;
  }).join('');
  const gridRows = (d.grid.UR || d.grid.UL || d.grid.LR || d.grid.LL)
    ? `<table class="grid"><tr><td>${d.grid.UR || ''}</td><td>${d.grid.UL || ''}</td></tr><tr><td>${d.grid.LR || ''}</td><td>${d.grid.LL || ''}</td></tr></table>` : '';
  const followUp = d.followNum ? `<p><b>${bn(d.followNum)} ${d.followUnit}</b> পর আসবেন।</p>` : '';
  const header = withHeader ? letterheadHead(s) : `<div style="height:150px"></div>`; // pre-printed pad-er jonno faka
  const footer = withHeader ? letterheadFoot(s) : '';
  const html = `<html><head><meta charset="utf-8"/><title>প্রেসক্রিপশন — ${patient.fullName}</title><style>
    *{box-sizing:border-box} body{font-family:'Nirmala UI','SolaimanLipi','Segoe UI',system-ui,sans-serif;padding:28px 28px 120px;color:#0f172a;font-size:13px}
    ${LETTERHEAD_CSS}
    .muted{color:#64748b;font-size:12px}
    .pt{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;border-bottom:1px solid #cbd5e1;padding:6px 0;font-size:13px}
    .pt b{font-weight:700}
    .body{display:flex;margin-top:10px} .left{width:34%;border-right:1px solid #94a3b8;padding-right:10px}
    .right{flex:1;padding-left:14px} .fld{margin-bottom:16px;line-height:1.45} .fld .l{font-weight:700;font-size:11px;color:#475569;margin-bottom:3px}
    .rx{font-size:30px;font-weight:700;line-height:1} .med{margin:12px 0;padding-left:10px} .med .nm{font-size:14px}
    .med .sub{display:flex;flex-wrap:wrap;gap:6px 32px;color:#334155;font-size:12px;margin-top:3px;padding-left:16px}
    .grid{border-collapse:collapse;margin-top:2px} .grid td{width:60px;height:24px;text-align:center;font-size:12px}
    .grid td:first-child{border-right:1px solid #475569} .grid tr:first-child td{border-bottom:1px solid #475569}
    .adv{margin-top:14px;border-top:1px dashed #cbd5e1;padding-top:6px}
    @media print{button{display:none}}</style></head><body>
    ${header}
    <div class="pt">
      <span>নামঃ <b>${patient.fullName}</b> &nbsp;&nbsp; বয়সঃ <b>${age ? bn(age) : '—'}</b> &nbsp;&nbsp; লিঙ্গঃ <b>${patient.gender || '—'}</b></span>
      <span>ফোনঃ ${patient.phone || '—'} &nbsp;&nbsp; তারিখঃ ${bn(new Date().toLocaleDateString('en-GB'))}</span>
    </div>
    <div class="body">
      <div class="left">
        ${d.cc ? `<div class="fld"><div class="l">প্রধান সমস্যা (C/C)</div>${d.cc}</div>` : ''}
        ${(d.oe || gridRows) ? `<div class="fld"><div class="l">পরীক্ষা (O/E)</div>${d.oe || ''}${gridRows}</div>` : ''}
        ${d.dx ? `<div class="fld"><div class="l">ডায়াগনোসিস</div>${d.dx}</div>` : ''}
        ${d.ix ? `<div class="fld"><div class="l">পরীক্ষা-নিরীক্ষা (Ix)</div>${d.ix}</div>` : ''}
      </div>
      <div class="right">
        <div class="rx" style="color:${c}">℞</div>
        ${meds || '<p class="muted">কোনো ওষুধ নেই।</p>'}
        ${d.advice ? `<div class="adv"><b>উপদেশঃ</b> ${d.advice}</div>` : ''}
        ${followUp}
      </div>
    </div>
    ${footer}</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}

export function PrescriptionsTab({ patient }: { patient: Patient }) {
  const patientId = patient.id;
  const { data: history = [] } = usePrescriptions(patientId);
  const { data: plans = [] } = useTreatment(patientId);
  const m = useRxMutations(patientId);

  const [d, setD] = useState<Draft>(emptyDraft);
  const set = (k: keyof Draft, v: any) => setD((p) => ({ ...p, [k]: v }));
  const setGrid = (k: keyof Grid, v: string) => setD((p) => ({ ...p, grid: { ...p.grid, [k]: v } }));
  const [items, setItems] = useState<RxItem[]>([]);

  const [query, setQuery] = useState('');
  const { data: results = [] } = useDrugs(query.length >= 2 ? query : '__none__');
  const [picked, setPicked] = useState<{ id: string; name: string; generic?: string; strength?: string } | null>(null);
  const [dose, setDose] = useState('১+০+১');
  const [durNum, setDurNum] = useState('7');
  const [durUnit, setDurUnit] = useState('দিন');
  const [timing, setTiming] = useState('খাবার পর');
  const [customTiming, setCustomTiming] = useState(false);

  const allergens = splitList(patient.medicalHistory?.allergies);
  const allergyHits = items.filter((it) => {
    const hay = `${it.drugName} ${it.generic || ''}`.toLowerCase();
    return allergens.some((a) => a && hay.includes(a.toLowerCase()));
  });

  const addItem = () => {
    if (!picked) return;
    setItems([...items, {
      drugId: picked.id,
      drugName: `${picked.name}${picked.strength ? ' ' + picked.strength : ''}`, // ওষুধ English
      generic: picked.generic, dosage: dose, timing,
      duration: durNum ? `${bn(durNum)} ${durUnit}` : undefined, // মেয়াদ Bangla
    }]);
    setPicked(null); setQuery('');
  };

  const buildPayload = () => ({
    diagnosis: d.dx || undefined, chiefComplaint: d.cc || undefined, onExam: d.oe || undefined,
    examGrid: (d.grid.UR || d.grid.UL || d.grid.LR || d.grid.LL) ? JSON.stringify(d.grid) : undefined,
    investigation: d.ix || undefined, notes: d.notes || undefined, advice: d.advice || undefined,
    followUp: d.followNum ? `${bn(d.followNum)} ${d.followUnit}` : undefined, planId: d.planId || undefined,
    items,
  });
  const reset = () => { setItems([]); setD(emptyDraft); };
  // Click a past prescription → load everything back into the form to reuse/edit.
  const loadRx = (rx: any) => {
    const fu = (rx.followUp || '').split(' ');
    setD({
      dx: rx.diagnosis || '', cc: rx.chiefComplaint || '', oe: rx.onExam || '',
      grid: rx.examGrid ? JSON.parse(rx.examGrid) : { UR: '', UL: '', LR: '', LL: '' },
      ix: rx.investigation || '', notes: rx.notes || '', advice: rx.advice || '',
      followNum: fu[0] ? enDigits(fu[0]) : '', followUnit: fu[1] || 'দিন',
      planId: rx.planId || '',
    });
    setItems((rx.items || []).map((i: any) => ({
      drugId: i.drugId, drugName: i.drugName, generic: i.generic,
      dosage: i.dosage, timing: i.timing, duration: i.duration, instruction: i.instruction,
    })));
    setPicked(null); setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = (then?: () => void) => {
    if (items.length === 0) return;
    m.create.mutate(buildPayload(), { onSuccess: () => { then?.(); reset(); } });
  };

  const lbl = 'mb-0.5 block text-[11px] font-semibold text-slate-600';
  const box = 'rounded-lg border border-border bg-white p-3';

  return (
    <div className="space-y-3">
      {/* রোগীর তথ্য + অ্যাকশন */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <div className="flex flex-wrap gap-x-4">
          <span><b>{patient.fullName}</b></span>
          <span className="text-muted-foreground">{patient.gender || '—'} · {patient.dateOfBirth ? bn(ageFromDob(patient.dateOfBirth)) : '—'}</span>
          <span className="text-muted-foreground">{patient.phone || 'ফোন নেই'}</span>
          <span className="text-muted-foreground">{patient.address || ''}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" disabled={items.length === 0} onClick={() => printRx(patient, d, items, true)}><Eye className="mr-1 h-4 w-4" />প্রিভিউ</Button>
          <Button size="sm" disabled={items.length === 0 || m.create.isPending} onClick={() => save(() => printRx(patient, d, items, true))}><Printer className="mr-1 h-4 w-4" />সেভ ও প্রিন্ট</Button>
          <Button size="sm" variant="outline" disabled={items.length === 0 || m.create.isPending} onClick={() => save(() => printRx(patient, d, items, false))}><Printer className="mr-1 h-4 w-4" />প্রিন্ট (হেডার ছাড়া)</Button>
          <Button size="sm" variant="outline" disabled={items.length === 0 || m.create.isPending} onClick={() => save()}><Save className="mr-1 h-4 w-4" />শুধু সেভ</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* বাম — ক্লিনিক্যাল */}
        <div className="space-y-3 lg:col-span-3">
          <div className={box}>
            <div><Label className={lbl}>রোগ / ডায়াগনোসিস</Label><Input value={d.dx} onChange={(e) => set('dx', e.target.value)} /></div>
            <div className="mt-2"><Label className={lbl}>প্রধান সমস্যা (C/C)</Label><textarea className="min-h-[44px] w-full rounded-md border border-border p-2 text-sm" value={d.cc} onChange={(e) => set('cc', e.target.value)} /></div>
            <div className="mt-2">
              <Label className={lbl}>পরীক্ষা (O/E)</Label>
              <textarea className="min-h-[40px] w-full rounded-md border border-border p-2 text-sm" value={d.oe} onChange={(e) => set('oe', e.target.value)} />
              <div className="mt-1 grid grid-cols-2 gap-1">
                {(['UR', 'UL', 'LR', 'LL'] as (keyof Grid)[]).map((q) => (
                  <div key={q} className="flex items-center gap-1">
                    <span className="w-6 text-[10px] font-bold text-muted-foreground">{q}</span>
                    <Input className="h-7 text-xs" value={d.grid[q]} onChange={(e) => setGrid(q, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2"><Label className={lbl}>পরীক্ষা-নিরীক্ষা (Ix)</Label><Input value={d.ix} onChange={(e) => set('ix', e.target.value)} /></div>
            <div className="mt-2">
              <Label className={lbl}>চিকিৎসা পরিকল্পনা (ঐচ্ছিক)</Label>
              <Select value={d.planId} onChange={(e) => set('planId', e.target.value)}>
                <option value="">— নেই —</option>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
            <div className="mt-2"><Label className={lbl}>নোট (শুধু নিজের জন্য — ছাপা হবে না)</Label><textarea className="min-h-[40px] w-full rounded-md border border-amber-300 bg-amber-50 p-2 text-sm" value={d.notes} onChange={(e) => set('notes', e.target.value)} /></div>
          </div>
        </div>

        {/* মাঝে — প্রেসক্রিপশন */}
        <div className="space-y-3 lg:col-span-6">
          <div className={box}>
            {picked ? (
              <div className="mb-2 flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                <span><b>{picked.name}</b> {picked.strength} — <span className="text-primary">{picked.generic}</span></span>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setPicked(null)}>পরিবর্তন</button>
              </div>
            ) : (
              <>
                <Label className={lbl}>ওষুধের নাম লিখুন</Label>
                <Input placeholder="যেমন: Napa, Moxacil, Tory…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query.length >= 2 && (
                  <div className="mt-1 max-h-52 overflow-auto rounded-md border border-border">
                    {results.length === 0 && <div className="p-2 text-xs text-muted-foreground">কোনো মিল নেই।</div>}
                    {results.map((dr) => (
                      <button key={dr.id} className="block w-full border-b border-border/40 px-3 py-1.5 text-left text-sm hover:bg-primary/10"
                        onClick={() => { setPicked({ id: dr.id, name: dr.name, generic: dr.generic, strength: dr.strength }); setQuery(''); }}>
                        <span className="font-medium">{dr.name}</span> <span className="text-xs text-muted-foreground">{dr.strength} · {dr.form}</span>
                        <span className="block text-[11px] text-primary/80">{dr.generic}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div><Label className={lbl}>ডোজ</Label><Select value={dose} onChange={(e) => setDose(e.target.value)}>{DOSES.map((x) => <option key={x}>{x}</option>)}</Select></div>
              <div><Label className={lbl}>মেয়াদ</Label><Select value={durNum} onChange={(e) => setDurNum(e.target.value)}>{NUMS.map((n) => <option key={n} value={n}>{bn(n)}</option>)}</Select></div>
              <div><Label className={lbl}>দিন / মাস</Label><Select value={durUnit} onChange={(e) => setDurUnit(e.target.value)}><option value="দিন">দিন</option><option value="মাস">মাস</option></Select></div>
              <div><Label className={lbl}>সেবনবিধি</Label>
                {customTiming ? (
                  <Input autoFocus value={timing} onChange={(e) => setTiming(e.target.value)} placeholder="নিজে লিখুন" onBlur={() => { if (!timing.trim()) { setCustomTiming(false); setTiming('খাবার পর'); } }} />
                ) : (
                  <Select value={timing} onChange={(e) => { if (e.target.value === '__custom') { setCustomTiming(true); setTiming(''); } else setTiming(e.target.value); }}>
                    {TIMINGS.map((x) => <option key={x}>{x}</option>)}
                    <option value="__custom">✏️ অন্যান্য (লিখুন)…</option>
                  </Select>
                )}
              </div>
            </div>
            <Button size="sm" className="mt-2 w-full" disabled={!picked} onClick={addItem}><Plus className="h-4 w-4" /> যোগ করুন</Button>
          </div>

          <div className={box}>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-slate-600">℞ প্রেসক্রিপশন ({bn(items.length)})</div>
            {allergyHits.length > 0 && (
              <div className="mb-2 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span><b>অ্যালার্জি সতর্কতা:</b> {allergyHits.map((h) => h.drugName).join(', ')} — রেকর্ডকৃত অ্যালার্জি ({allergens.join(', ')})।</span>
              </div>
            )}
            {items.length === 0 && <p className="text-sm text-muted-foreground">কোনো ওষুধ যোগ করা হয়নি।</p>}
            <div className="space-y-1.5">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                  <div>
                    <div className="font-medium">{bn(idx + 1)}. {it.drugName} {it.generic && <span className="font-normal text-primary">· {it.generic}</span>}</div>
                    <div className="text-xs text-muted-foreground">{it.dosage}{it.timing ? ` · ${it.timing}` : ''}{it.duration ? ` · ${it.duration}` : ''}</div>
                  </div>
                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3"><Label className={lbl}>উপদেশ</Label><textarea className="min-h-[44px] w-full rounded-md border border-border p-2 text-sm" placeholder="যেমন: ঠান্ডা জাতীয় খাবার নিষেধ।" value={d.advice} onChange={(e) => set('advice', e.target.value)} /></div>
            <div className="mt-2 flex items-end gap-2">
              <div className="w-20"><Label className={lbl}>ফলোআপ</Label><Select value={d.followNum} onChange={(e) => set('followNum', e.target.value)}><option value="">—</option>{NUMS.map((n) => <option key={n} value={n}>{bn(n)}</option>)}</Select></div>
              <div className="w-24"><Select value={d.followUnit} onChange={(e) => set('followUnit', e.target.value)}><option value="দিন">দিন</option><option value="মাস">মাস</option></Select></div>
              <span className="pb-2 text-sm text-muted-foreground">পর আসবেন</span>
            </div>
          </div>
        </div>

        {/* ডান — ইতিহাস */}
        <div className="space-y-3 lg:col-span-3">
          <div className={box}>
            <div className="mb-2 text-[11px] font-semibold text-slate-600">পূর্বের প্রেসক্রিপশন ({bn(history.length)})</div>
            {history.length === 0 && <p className="text-sm text-muted-foreground">এখনো নেই।</p>}
            <div className="space-y-2">
              {history.map((rx) => (
                <button key={rx.id} type="button" onClick={() => loadRx(rx)} title="ক্লিক করে ফর্মে আনুন (এডিট/পুনরায় ব্যবহার)"
                  className="block w-full rounded-md border border-border p-2 text-left hover:border-primary/50 hover:bg-primary/5">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{fmtDate(rx.createdAt)}</span>
                    <div className="flex gap-1.5">
                      <button title="প্রিন্ট" onClick={(e) => { e.stopPropagation(); printRx(patient, { ...emptyDraft, dx: rx.diagnosis || '', cc: rx.chiefComplaint || '', oe: rx.onExam || '', ix: rx.investigation || '', advice: rx.advice || '', grid: rx.examGrid ? JSON.parse(rx.examGrid) : emptyDraft.grid }, rx.items, true); }} className="text-muted-foreground hover:text-primary"><Printer className="h-4 w-4" /></button>
                      <button title="মুছুন" onClick={(e) => { e.stopPropagation(); if (confirm('এই প্রেসক্রিপশন মুছবেন?')) m.remove.mutate(rx.id); }} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  {rx.diagnosis && <p className="text-sm font-medium">ডা: {rx.diagnosis}</p>}
                  <ul className="mt-0.5 space-y-0.5 text-xs">
                    {rx.items.map((it, i) => <li key={i}>• {it.drugName} <span className="text-muted-foreground">{it.dosage}{it.duration ? ` · ${it.duration}` : ''}</span></li>)}
                  </ul>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
