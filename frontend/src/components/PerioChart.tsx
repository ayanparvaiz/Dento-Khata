import { useEffect, useState } from 'react';
import { ADULT_LOWER, ADULT_UPPER, parse6, type PerioRecord } from '@/lib/charting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 6 probing sites per tooth, order: buccal MB,B,DB then lingual ML,L,DL.
const SITES = ['MB', 'B', 'DB', 'ML', 'L', 'DL'];

interface ToothPerio {
  pocket: number[];
  recession: number[];
  bleeding: boolean[];
  mobility: number;
}
const blank = (): ToothPerio => ({
  pocket: [0, 0, 0, 0, 0, 0],
  recession: [0, 0, 0, 0, 0, 0],
  bleeding: [false, false, false, false, false, false],
  mobility: 0,
});

const COL = 66; // px per tooth column
const GH = 56; // graph height
const MAXD = 12;
const y = (d: number) => GH - (Math.min(d, MAXD) / MAXD) * GH + 4;

export function PerioChart({
  perio,
  onSave,
  saving,
}: {
  perio: PerioRecord[];
  onSave: (rows: { toothNumber: string; pocketDepth: string; recession: string; bleeding: string; mobility: number }[]) => void;
  saving: boolean;
}) {
  const [arch, setArch] = useState<'upper' | 'lower'>('upper');
  const teeth = arch === 'upper' ? ADULT_UPPER : ADULT_LOWER;
  const [data, setData] = useState<Record<string, ToothPerio>>({});

  // Hydrate local state from saved records whenever they change.
  useEffect(() => {
    const next: Record<string, ToothPerio> = {};
    for (const t of teeth) {
      const rec = perio.find((p) => p.toothNumber === t);
      next[t] = rec
        ? {
            pocket: parse6(rec.pocketDepth) as number[],
            recession: parse6((rec as any).recession) as number[],
            bleeding: parse6((rec as any).bleeding, false) as boolean[],
            mobility: rec.mobility ?? 0,
          }
        : blank();
    }
    setData(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perio, arch]);

  const set = (t: string, fn: (tp: ToothPerio) => ToothPerio) =>
    setData((d) => ({ ...d, [t]: fn(d[t] ?? blank()) }));

  const save = () => {
    const rows = teeth
      .map((t) => {
        const tp = data[t] ?? blank();
        const has =
          tp.pocket.some(Boolean) || tp.recession.some(Boolean) || tp.bleeding.some(Boolean) || tp.mobility;
        if (!has) return null;
        return {
          toothNumber: t,
          pocketDepth: JSON.stringify(tp.pocket),
          recession: JSON.stringify(tp.recession),
          bleeding: JSON.stringify(tp.bleeding),
          mobility: tp.mobility,
        };
      })
      .filter(Boolean) as any[];
    onSave(rows);
  };

  const width = teeth.length * COL;

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button size="sm" variant={arch === 'upper' ? 'default' : 'outline'} onClick={() => setArch('upper')}>
              Upper arch
            </Button>
            <Button size="sm" variant={arch === 'lower' ? 'default' : 'outline'} onClick={() => setArch('lower')}>
              Lower arch
            </Button>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-primary" /> Pocket depth</span>
            <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-warning" /> Recession</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" /> Bleeding</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ width }}>
            {/* Line graph (buccal sites) */}
            <svg width={width} height={GH + 10} className="rounded bg-muted/40">
              {/* depth gridlines at 3 and 6 mm */}
              {[3, 6].map((d) => (
                <line key={d} x1={0} x2={width} y1={y(d)} y2={y(d)} stroke="#e2e8f0" strokeWidth="1" />
              ))}
              {(() => {
                const pocketPts: string[] = [];
                const recPts: string[] = [];
                const dots: { cx: number; cy: number }[] = [];
                teeth.forEach((t, ti) => {
                  const tp = data[t] ?? blank();
                  for (let p = 0; p < 3; p++) {
                    const cx = ti * COL + p * (COL / 3) + 10;
                    pocketPts.push(`${cx},${y(tp.pocket[p])}`);
                    recPts.push(`${cx},${y(tp.recession[p])}`);
                    if (tp.bleeding[p]) dots.push({ cx, cy: y(tp.pocket[p]) });
                  }
                });
                return (
                  <>
                    <polyline points={recPts.join(' ')} fill="none" stroke="#d97706" strokeWidth="1.5" />
                    <polyline points={pocketPts.join(' ')} fill="none" stroke="#0f766e" strokeWidth="1.5" />
                    {dots.map((d, i) => (
                      <circle key={i} cx={d.cx} cy={d.cy} r="2.5" fill="#dc2626" />
                    ))}
                  </>
                );
              })()}
            </svg>

            {/* Input grid */}
            <div className="flex" style={{ width }}>
              {teeth.map((t) => {
                const tp = data[t] ?? blank();
                const cell = (group: 'pocket' | 'recession', i: number) => (
                  <input
                    key={group + i}
                    inputMode="numeric"
                    value={tp[group][i] || ''}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(12, Number(e.target.value) || 0));
                      set(t, (x) => ({ ...x, [group]: x[group].map((o, j) => (j === i ? v : o)) }));
                    }}
                    className={cn(
                      'h-6 w-5 rounded border text-center text-[10px] outline-none',
                      group === 'pocket' && tp.pocket[i] >= 6
                        ? 'border-danger bg-danger/10'
                        : group === 'pocket' && tp.pocket[i] >= 4
                          ? 'border-warning bg-warning/10'
                          : 'border-border',
                    )}
                  />
                );
                const bopRow = (offset: number) => (
                  <div className="flex justify-center gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <button
                        key={i}
                        title="Bleeding on probing"
                        onClick={() =>
                          set(t, (x) => ({ ...x, bleeding: x.bleeding.map((o, j) => (j === offset + i ? !o : o)) }))
                        }
                        className={cn(
                          'h-2.5 w-2.5 rounded-full border',
                          tp.bleeding[offset + i] ? 'border-danger bg-danger' : 'border-border bg-white',
                        )}
                      />
                    ))}
                  </div>
                );
                return (
                  <div key={t} className="flex flex-col items-center gap-0.5 border-r border-border/40 px-1 py-1" style={{ width: COL }}>
                    <div className="text-[10px] font-semibold">{t}</div>
                    <div className="text-[8px] text-muted-foreground">Buccal PD</div>
                    <div className="flex gap-0.5">{[0, 1, 2].map((i) => cell('pocket', i))}</div>
                    {bopRow(0)}
                    <div className="text-[8px] text-muted-foreground">Lingual PD</div>
                    <div className="flex gap-0.5">{[3, 4, 5].map((i) => cell('pocket', i))}</div>
                    {bopRow(3)}
                    <div className="text-[8px] text-muted-foreground">Recession B</div>
                    <div className="flex gap-0.5">{[0, 1, 2].map((i) => cell('recession', i))}</div>
                    <select
                      value={tp.mobility}
                      onChange={(e) => set(t, (x) => ({ ...x, mobility: Number(e.target.value) }))}
                      className="mt-0.5 h-5 rounded border border-border text-[9px]"
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>M{n}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : `Save ${arch} arch`}
          </Button>
          <span className="text-xs text-muted-foreground">
            Sites: {SITES.join(' · ')} · pocket ≥4mm amber, ≥6mm red · click dot = bleeding
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
