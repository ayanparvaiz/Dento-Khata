import { useEffect, useState } from 'react';
import {
  ADULT_LOWER, ADULT_UPPER, CHILD_LOWER, CHILD_UPPER,
  CONDITION_COLOR, CONDITIONS, STATUSES, WHOLE_CONDITIONS,
  displayTooth, surfaceForZone, useChart, useChartMutations,
  type Notation, type Zone, type ToothRecord,
} from '@/lib/charting';
import { AnatomicalTooth } from '@/components/AnatomicalTooth';
import { PerioChart } from '@/components/PerioChart';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2, X, Pencil } from 'lucide-react';

const isAnterior = (fdi: string) => ['1', '2', '3'].includes(fdi[1]);
const surfacesFor = (fdi: string) => ['M', 'D', isAnterior(fdi) ? 'I' : 'O', 'B', 'L'];

export function DentalChart({ patientId }: { patientId: string }) {
  const { data: chart } = useChart(patientId);
  const m = useChartMutations(patientId);
  const [view, setView] = useState<'odontogram' | 'perio'>('odontogram');
  const [notation, setNotation] = useState<Notation>('PALMER'); // Palmer is most common in BD
  const [dentition, setDentition] = useState<'adult' | 'child'>('adult');
  const [selected, setSelected] = useState<string | null>(null);
  // editor target: which tooth, and (optionally) a clicked surface or an existing record to edit
  const [editor, setEditor] = useState<{ fdi: string; surface?: string; recordId?: string } | null>(null);

  const upper = dentition === 'adult' ? ADULT_UPPER : CHILD_UPPER;
  const lower = dentition === 'adult' ? ADULT_LOWER : CHILD_LOWER;
  const recordsFor = (fdi: string) => chart?.teeth.filter((t) => t.toothNumber === fdi) ?? [];

  // Click a tooth surface → open the editor (prefilled to edit if that surface already has a finding).
  const handleZone = (fdi: string, zone: Zone) => {
    setSelected(fdi);
    const surface = surfaceForZone(fdi, zone);
    const hit = recordsFor(fdi).find((r) => r.surface === surface && !WHOLE_CONDITIONS.has(r.condition));
    setEditor({ fdi, surface, recordId: hit?.id });
  };

  const savePerioRows = async (rows: any[]) => {
    for (const r of rows) await m.perio.mutateAsync(r);
  };

  const arch = (teeth: string[]) => (
    <div className="flex justify-center gap-1">
      {teeth.map((fdi) => (
        <AnatomicalTooth
          key={fdi}
          fdi={fdi}
          notation={notation}
          records={recordsFor(fdi)}
          selected={selected === fdi}
          onZone={(zone) => handleZone(fdi, zone)}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        <Button size="sm" variant={view === 'odontogram' ? 'default' : 'outline'} onClick={() => setView('odontogram')}>Odontogram</Button>
        <Button size="sm" variant={view === 'perio' ? 'default' : 'outline'} onClick={() => setView('perio')}>Periodontal chart</Button>
      </div>

      {view === 'perio' ? (
        <PerioChart perio={chart?.perio ?? []} onSave={savePerioRows} saving={m.perio.isPending} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="mb-0">Notation</Label>
                  <Select className="h-8 w-32" value={notation} onChange={(e) => setNotation(e.target.value as Notation)}>
                    <option value="FDI">FDI</option>
                    <option value="UNIVERSAL">Universal</option>
                    <option value="PALMER">Palmer</option>
                  </Select>
                  <div className="ml-2 flex items-center gap-1">
                    <Button size="sm" variant={dentition === 'adult' ? 'default' : 'outline'} onClick={() => setDentition('adult')}>Adult</Button>
                    <Button size="sm" variant={dentition === 'child' ? 'default' : 'outline'} onClick={() => setDentition('child')}>Child</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Click a tooth surface to record or edit a finding.</p>
              </div>

              {/* Anatomical odontogram */}
              <div className="space-y-3 overflow-x-auto rounded-lg bg-muted/40 p-4">
                {arch(upper)}
                <div className="my-1 border-t border-dashed border-border" />
                {arch(lower)}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {CONDITIONS.filter((c) => c !== 'HEALTHY').map((c) => (
                  <span key={c} className="flex items-center gap-1">
                    <span className="h-3 w-3 rounded-sm border" style={{ backgroundColor: CONDITION_COLOR[c] + '55', borderColor: CONDITION_COLOR[c] }} />
                    {c}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Findings panel — click any finding to edit it */}
          <Card>
            <CardContent className="pt-5">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Click a tooth to view its findings, or click a surface to add one.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">
                      Tooth {displayTooth(selected, notation)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">(FDI {selected})</span>
                    </h3>
                    <Button size="sm" variant="outline" onClick={() => setEditor({ fdi: selected })}>+ Finding</Button>
                  </div>
                  {recordsFor(selected).length === 0 && <p className="text-xs text-muted-foreground">No findings yet — click a surface on the tooth.</p>}
                  {recordsFor(selected).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setEditor({ fdi: selected, recordId: r.id })}
                      className="flex w-full items-center justify-between rounded-md border border-border p-2 text-left text-sm hover:bg-muted"
                    >
                      <div>
                        <span className="font-medium" style={{ color: CONDITION_COLOR[r.condition] }}>{r.condition}</span>
                        {r.surface && <span className="text-muted-foreground"> · {r.surface}</span>}
                        <span className="ml-1 text-xs text-muted-foreground">· {r.status}</span>
                        {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                      </div>
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {editor && (
        <ToothEditor
          fdi={editor.fdi}
          initialSurface={editor.surface}
          recordId={editor.recordId}
          records={recordsFor(editor.fdi)}
          notation={notation}
          m={m}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function ToothEditor({
  fdi, initialSurface, recordId, records, notation, m, onClose,
}: {
  fdi: string;
  initialSurface?: string;
  recordId?: string;
  records: ToothRecord[];
  notation: Notation;
  m: ReturnType<typeof useChartMutations>;
  onClose: () => void;
}) {
  const editing = records.find((r) => r.id === recordId);
  const [editId, setEditId] = useState<string | undefined>(recordId);
  const [condition, setCondition] = useState(editing?.condition ?? '');
  const [status, setStatus] = useState(editing?.status ?? 'EXISTING');
  const [surface, setSurface] = useState(editing?.surface ?? initialSurface ?? surfacesFor(fdi)[2]);
  const [note, setNote] = useState(editing?.note ?? '');

  // when switching which record we edit (clicking another finding), reload the form
  const loadRecord = (r: ToothRecord) => {
    setEditId(r.id); setCondition(r.condition); setStatus(r.status);
    setSurface(r.surface ?? surfacesFor(fdi)[2]); setNote(r.note ?? '');
  };
  const reset = () => { setEditId(undefined); setCondition(''); setStatus('EXISTING'); setSurface(initialSurface ?? surfacesFor(fdi)[2]); setNote(''); };
  useEffect(() => { if (recordId) { const r = records.find((x) => x.id === recordId); if (r) loadRecord(r); } /* eslint-disable-next-line */ }, [recordId]);

  const whole = WHOLE_CONDITIONS.has(condition);
  const save = () => {
    if (!condition) return;
    if (editId) {
      m.update.mutate({ id: editId, condition, status, note: note || undefined }, { onSuccess: onClose });
    } else {
      m.add.mutate({ toothNumber: fdi, surface: whole ? undefined : surface, condition, status, note: note || undefined }, { onSuccess: onClose });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Tooth {displayTooth(fdi, notation)} <span className="text-sm font-normal text-muted-foreground">(FDI {fdi})</span>
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {/* existing findings on this tooth */}
        {records.length > 0 && (
          <div className="mb-4 space-y-1">
            <Label>Existing findings</Label>
            {records.map((r) => (
              <div key={r.id} className={cn('flex items-center justify-between rounded-md border p-1.5 text-sm', editId === r.id ? 'border-primary bg-primary/5' : 'border-border')}>
                <button className="flex items-center gap-2 text-left" onClick={() => loadRecord(r)}>
                  <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: CONDITION_COLOR[r.condition] }} />
                  <span className="font-medium">{r.condition}</span>
                  {r.surface && <span className="text-xs text-muted-foreground">· {r.surface}</span>}
                  <span className="text-xs text-muted-foreground">· {r.status}</span>
                </button>
                <button onClick={() => m.remove.mutate(r.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label>{editId ? 'Condition' : 'New finding — condition'}</Label>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.filter((c) => c !== 'HEALTHY').map((c) => (
                <button
                  key={c}
                  onClick={() => setCondition(c)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition', condition === c ? 'text-white' : 'hover:bg-muted')}
                  style={condition === c ? { backgroundColor: CONDITION_COLOR[c], borderColor: CONDITION_COLOR[c] } : { borderColor: CONDITION_COLOR[c] + '88', color: CONDITION_COLOR[c] }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* surface (hidden for whole-tooth conditions; locked when editing an existing record) */}
          {!whole && (
            <div>
              <Label>Surface</Label>
              {editId ? (
                <span className="ml-1 text-sm text-muted-foreground">{surface || '—'} <span className="text-xs">(surface fixed; delete &amp; re-add to change)</span></span>
              ) : (
                <div className="flex gap-1.5">
                  {surfacesFor(fdi).map((s) => (
                    <button key={s} onClick={() => setSurface(s)}
                      className={cn('h-8 w-9 rounded-md border text-sm font-medium', surface === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Status</Label>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn('rounded-md border px-3 py-1 text-sm font-medium', status === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. distal margin, watch, refer…" />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={save} disabled={!condition || m.add.isPending || m.update.isPending}>
              {editId ? 'Save changes' : 'Add finding'}
            </Button>
            {editId && <Button variant="ghost" onClick={reset}>+ Add another</Button>}
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
