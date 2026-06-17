import { useState } from 'react';
import { useLedger, usePayments, useBillingMutations, taka } from '@/lib/clinical';
import { fmtDate } from '@/lib/format';
import type { Patient } from '@/lib/patients';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

const METHODS = ['CASH', 'BKASH', 'NAGAD', 'CARD', 'OTHER'];

export function BillingTab({ patient }: { patient: Patient }) {
  const id = patient.id;
  const { data: ledger } = useLedger(id);
  const { data: payments = [] } = usePayments(id);
  const m = useBillingMutations(id);
  const [pay, setPay] = useState({ amount: '', method: 'CASH', note: '' });

  const balance = ledger?.balance ?? 0;

  return (
    <div className="space-y-4">
      {/* Account summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Total treatment cost</div><div className="text-xl font-bold">{taka(ledger?.total || 0)}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Paid (installments)</div><div className="text-xl font-bold text-success">{taka(ledger?.paid || 0)}</div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="text-xs text-muted-foreground">Balance due</div><div className={`text-xl font-bold ${balance > 0 ? 'text-danger' : 'text-success'}`}>{taka(balance)}</div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Collect installment */}
        <Card>
          <CardHeader><CardTitle>Collect payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Patient pays a bit each visit — balance reduces automatically.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Amount ৳</Label>
                <Input type="number" placeholder="e.g. 500" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((x) => <option key={x}>{x}</option>)}</Select>
              </div>
            </div>
            <div><Label>Note (optional)</Label><Input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} /></div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!Number(pay.amount) || m.pay.isPending}
                onClick={() => m.pay.mutate({ amount: Number(pay.amount), method: pay.method, note: pay.note || undefined }, { onSuccess: () => setPay({ amount: '', method: 'CASH', note: '' }) })}
              >
                Take {pay.amount ? taka(Number(pay.amount)) : 'payment'}
              </Button>
              {balance > 0 && (
                <Button variant="outline" onClick={() => setPay({ ...pay, amount: String(balance) })}>Full balance {taka(balance)}</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment history */}
        <Card>
          <CardHeader>
            <CardTitle>Payment history ({payments.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <div>
                  <span className="font-semibold">{taka(p.amount)}</span>
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">{p.method}</span>
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(p.paidAt)}{p.note ? ` · ${p.note}` : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
