import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDailyCollection, useOutstanding, taka } from '@/lib/clinical';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);

export function Reports() {
  const [date, setDate] = useState(today());
  const navigate = useNavigate();
  const { data: daily } = useDailyCollection(date);
  const { data: outstanding } = useOutstanding();

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Reports</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily collection */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Daily collection</CardTitle>
            <div className="flex items-center gap-2">
              <Input type="date" className="h-8 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 text-3xl font-bold">{taka(daily?.total || 0)}</div>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(daily?.byMethod || {}).map(([m, v]) => (
                <span key={m} className="rounded-full bg-muted px-3 py-1 text-sm">{m}: {taka(v as number)}</span>
              ))}
              {(!daily || daily.count === 0) && <span className="text-sm text-muted-foreground">No payments on this date.</span>}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {(daily?.payments || []).map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-1">{p.patient}</td>
                    <td className="py-1 text-muted-foreground">{p.invoice}</td>
                    <td className="py-1">{p.method}</td>
                    <td className="py-1 text-right font-medium">{taka(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Outstanding dues */}
        <Card>
          <CardHeader><CardTitle>Outstanding dues — {taka(outstanding?.totalOutstanding || 0)}</CardTitle></CardHeader>
          <CardContent>
            {(!outstanding || outstanding.rows.length === 0) && <p className="text-sm text-muted-foreground">No outstanding balances 🎉</p>}
            <table className="w-full text-sm">
              <tbody>
                {(outstanding?.rows || []).map((r: any) => (
                  <tr key={r.invoiceId} className="cursor-pointer border-b border-border/50 hover:bg-muted" onClick={() => navigate(`/patients/${r.patientId}`)}>
                    <td className="py-1 font-medium">{r.patient}</td>
                    <td className="py-1 font-mono text-xs">{r.number}</td>
                    <td className="py-1"><span className={`rounded-full px-2 py-0.5 text-xs ${r.status === 'PARTIAL' ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'}`}>{r.status}</span></td>
                    <td className="py-1 text-right font-semibold text-danger">{taka(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
