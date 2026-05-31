import { useState } from 'react';
import {
  ADULT_LOWER, ADULT_UPPER, CHILD_LOWER, CHILD_UPPER,
  CONDITION_COLOR, CONDITIONS, STATUSES, WHOLE_CONDITIONS,
  displayTooth, surfaceForZone, useChart, useChartMutations,
  type Notation, type Zone,
} from '@/lib/charting';
import { AnatomicalTooth } from '@/components/AnatomicalTooth';
import { PerioChart } from '@/components/PerioChart';
import { Button } from '@/components/ui/button';
import { Label, Select } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

export function DentalChart({ patientId }: { patientId: string }) {
  const { data: chart } = useChart(patientId);
  const m = useChartMutations(patientId);
  const [view, setView] = useState<'odontogram' | 'perio'>('odontogram');
  const [notation, setNotation] = useState<Notation>('FDI');
  const [dentition, setDentition] = useState<'adult' | 'child'>('adult');
  const [selected, setSelected] = useState<string | null>(null);
  const [condition, setCondition] = useState<string>('CARIES'); // active "brush"; '' = inspect only
  const [status, setStatus] = useState('EXISTING');

  const upper = dentition === 'adult' ? ADULT_UPPER : CHILD_UPPER;
  const lower = dentition === 'adult' ? ADULT_LOWER : CHILD_LOWER;
  const recordsFor = (fdi: string) => chart?.teeth.filter((t) => t.toothNumber === fdi) ?? [];
  const selectedRecords = selected ? recordsFor(selected) : [];

  const handleZone = (fdi: string, zone: Zone) => {
    setSelected(fdi);
    if (!condition) return; // inspect mode
    const surface = WHOLE_CONDITIONS.has(condition) ? undefined : surfaceForZone(fdi, zone);
    m.add.mutate({ toothNumber: fdi, condition, surface, status });
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
      {/* View toggle */}
      <div className="flex items-center gap-1">
        <Button size="sm" variant={view === 'odontogram' ? 'default' : 'outline'} onClick={() => setView('odontogram')}>
          Odontogram
        </Button>
        <Button size="sm" variant={view === 'perio' ? 'default' : 'outline'} onClick={() => setView('perio')}>
          Periodontal chart
        </Button>
      </div>

      {view === 'perio' ? (
        <PerioChart perio={chart?.perio ?? []} onSave={savePerioRows} saving={m.perio.isPending} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label className="mb-0">Notation</Label>
                  <Select className="h-8 w-32" value={notation} onChange={(e) => setNotation(e.target.value as Notation)}>
                    <option value="FDI">FDI</option>
                    <option value="UNIVERSAL">Universal</option>
                    <option value="PALMER">Palmer</option>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={dentition === 'adult' ? 'default' : 'outline'} onClick={() => setDentition('adult')}>Adult</Button>
                  <Button size="sm" variant={dentition === 'child' ? 'default' : 'outline'} onClick={() => setDentition('child')}>Child</Button>
                </div>
              </div>

              {/* Active brush */}
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                <div>
                  <Label>Marking</Label>
                  <Select className="h-8 w-40" value={condition} onChange={(e) => setCondition(e.target.value)}>
                    <option value="">Inspect (no mark)</option>
                    {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select className="h-8 w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {condition ? 'Click a tooth surface to mark it.' : 'Inspect mode — click a tooth to view findings.'}
                </p>
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

          {/* Findings panel */}
          <Card>
            <CardContent className="pt-5">
              {!selected ? (
                <p className="text-sm text-muted-foreground">Select a tooth to view findings.</p>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold">
                    Tooth {displayTooth(selected, notation)}{' '}
                    <span className="text-xs font-normal text-muted-foreground">(FDI {selected})</span>
                  </h3>
                  {selectedRecords.length === 0 && <p className="text-xs text-muted-foreground">No findings yet.</p>}
                  {selectedRecords.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                      <div>
                        <span className="font-medium" style={{ color: CONDITION_COLOR[r.condition] }}>{r.condition}</span>
                        {r.surface && <span className="text-muted-foreground"> · {r.surface}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select className="h-7 w-28 text-xs" value={r.status} onChange={(e) => m.update.mutate({ id: r.id, status: e.target.value })}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </Select>
                        <button onClick={() => m.remove.mutate(r.id)} className={cn('text-muted-foreground hover:text-danger')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
