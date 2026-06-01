import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRevenue, useOutstanding, taka, type Revenue } from '@/lib/clinical';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Download, TrendingUp, Wallet, Receipt, AlertCircle } from 'lucide-react';

const PERIODS = [
  { key: 1, label: 'Today' },
  { key: 7, label: 'Week' },
  { key: 30, label: 'Month' },
  { key: 90, label: '3 Months' },
  { key: 180, label: '6 Months' },
  { key: 365, label: '1 Year' },
] as const;

const METHOD_COLOR: Record<string, string> = {
  CASH: '#16a34a', BKASH: '#db2777', NAGAD: '#ea580c', CARD: '#2563eb', OTHER: '#6b7280',
};
const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

// Bucket the daily series into a sensible number of bars for the chosen window.
function buildBuckets(rev: Revenue | undefined, days: number) {
  if (!rev) return [] as { label: string; amount: number }[];
  const map = new Map(rev.series.map((s) => [s.date, s.amount]));
  const start = new Date(rev.from + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  if (days <= 14) {
    const out: { label: string; amount: number }[] = [];
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1))
      out.push({ label: fmtDay(d), amount: map.get(key(new Date(d))) || 0 });
    return out;
  }
  if (days <= 92) {
    // weekly buckets
    const out: { label: string; amount: number }[] = [];
    for (let s = new Date(start); s <= today; s.setDate(s.getDate() + 7)) {
      const e = new Date(s); e.setDate(e.getDate() + 6);
      let sum = 0;
      for (let d = new Date(s); d <= e && d <= today; d.setDate(d.getDate() + 1)) sum += map.get(key(new Date(d))) || 0;
      out.push({ label: fmtDay(new Date(s)), amount: sum });
    }
    return out;
  }
  // monthly buckets
  const months = new Map<string, number>();
  for (const [date, amt] of map) {
    const mk = date.slice(0, 7);
    months.set(mk, (months.get(mk) || 0) + amt);
  }
  const out: { label: string; amount: number }[] = [];
  const c = new Date(start.getFullYear(), start.getMonth(), 1);
  while (c <= today) {
    const mk = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`;
    out.push({ label: c.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), amount: months.get(mk) || 0 });
    c.setMonth(c.getMonth() + 1);
  }
  return out;
}

function BarChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const W = 900, H = 240, pad = { l: 56, r: 12, t: 12, b: 28 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const n = data.length || 1;
  const gap = n > 30 ? 1 : 6;
  const bw = Math.max(2, cw / n - gap);
  const ticks = 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 280 }}>
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const y = pad.t + (ch * i) / ticks;
        const val = Math.round((max * (ticks - i)) / ticks);
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={11}>{taka(val)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.amount / max) * ch;
        const x = pad.l + i * (cw / n) + gap / 2;
        const y = pad.t + ch - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={2} className="fill-primary">
              <title>{d.label}: {taka(d.amount)}</title>
            </rect>
            {(n <= 16 || i % Math.ceil(n / 12) === 0) && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{d.label}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone = 'primary' }: any) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary', green: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600', red: 'bg-rose-500/10 text-rose-600',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="truncate text-xl font-bold">{value}</div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function Reports() {
  const [days, setDays] = useState<number>(30);
  const navigate = useNavigate();
  const { data: rev } = useRevenue(days);
  const { data: outstanding } = useOutstanding();

  const buckets = useMemo(() => buildBuckets(rev, days), [rev, days]);
  const periodLabel = PERIODS.find((p) => p.key === days)?.label ?? `${days}d`;
  const avgPerDay = rev ? rev.total / days : 0;
  const methods = Object.entries(rev?.byMethod || {}).sort((a, b) => b[1] - a[1]);
  const methodMax = Math.max(1, ...methods.map(([, v]) => v));

  const exportCsv = () => {
    const lines = [['Date', 'Revenue'], ...(rev?.series || []).map((s) => [s.date, String(s.amount)])];
    const csv = lines.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `revenue-${periodLabel.toLowerCase().replace(/\s/g, '')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics &amp; Reports</h1>
          <p className="text-sm text-muted-foreground">Revenue &amp; income overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="mr-1.5 h-4 w-4" />Export</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setDays(p.key)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              days === p.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >{p.label}</button>
        ))}
      </div>

      {/* KPI row */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={TrendingUp} tone="green" label={`Revenue · ${periodLabel}`} value={taka(rev?.total || 0)} sub={`${rev?.count || 0} payments`} />
        <Kpi icon={Wallet} tone="primary" label="Avg / day" value={taka(Math.round(avgPerDay))} sub={`over ${days} day${days > 1 ? 's' : ''}`} />
        <Kpi icon={Receipt} tone="amber" label="Payments" value={String(rev?.count || 0)} sub={`since ${rev?.from || '—'}`} />
        <Kpi icon={AlertCircle} tone="red" label="Outstanding dues" value={taka(outstanding?.totalOutstanding || 0)} sub={`${outstanding?.rows?.length || 0} patients`} />
      </div>

      {/* Revenue trend */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Revenue trend — {periodLabel}</CardTitle>
          <span className="text-sm font-semibold text-emerald-600">{taka(rev?.total || 0)}</span>
        </CardHeader>
        <CardContent>
          {buckets.some((b) => b.amount > 0) ? <BarChart data={buckets} /> : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">No revenue in this period.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment methods */}
        <Card>
          <CardHeader><CardTitle>Payment methods</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {methods.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {methods.map(([m, v]) => {
              const pct = rev?.total ? Math.round((v / rev.total) * 100) : 0;
              return (
                <div key={m}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{m}</span>
                    <span className="text-muted-foreground">{taka(v)} · {pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(v / methodMax) * 100}%`, background: METHOD_COLOR[m] || METHOD_COLOR.OTHER }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Outstanding dues */}
        <Card>
          <CardHeader><CardTitle>Outstanding dues — {taka(outstanding?.totalOutstanding || 0)}</CardTitle></CardHeader>
          <CardContent>
            {(!outstanding || outstanding.rows.length === 0) && <p className="text-sm text-muted-foreground">No outstanding balances 🎉</p>}
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {(outstanding?.rows || []).map((r: any) => (
                    <tr key={r.patientId} className="cursor-pointer border-b border-border/50 hover:bg-muted" onClick={() => navigate(`/patients/${r.patientId}`)}>
                      <td className="py-1.5 font-medium">{r.patient}</td>
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{r.patientCode}</td>
                      <td className="py-1.5 text-right text-xs text-muted-foreground">paid {taka(r.paid)}</td>
                      <td className="py-1.5 text-right font-semibold text-rose-600">{taka(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
