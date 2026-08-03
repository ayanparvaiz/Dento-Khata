import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Copy, Check, MessageCircle } from 'lucide-react';
import { fbTrack } from '@/lib/meta';
import { PLANS, bn, perMonth, savings } from '@/lib/pricing';

function CopyNumber({ number }: { number: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(number).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  return (
    <button type="button" onClick={copy} title="নম্বর কপি করুন"
      className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 font-mono text-base font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100">
      {number}
      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-70" />}
      <span className="font-sans text-xs font-medium">{copied ? 'কপি হয়েছে ✓' : 'কপি'}</span>
    </button>
  );
}

// In-app subscription management: an ACTIVE clinic can renew or change package here.
// Same manual-bKash strategy as the paywall — pick a package, Send Money, submit the TrxID;
// on verification the days are added on top of the current period.
export function Subscribe() {
  const { sub, refreshSub } = useAuth();
  const [planKey, setPlanKey] = useState('6m');
  const selectedPlan = PLANS.find((p) => p.key === planKey) || PLANS[0];
  const [trxId, setTrxId] = useState('');
  const [sender, setSender] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const bkash = sub?.bkashNumber ?? '—';
  const whatsapp = sub?.whatsapp || '';
  const daysLeft = sub?.daysLeft;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId.trim()) { setError('অনুগ্রহ করে Transaction ID দিন'); return; }
    setBusy(true); setError(''); setMsg('');
    try {
      await api.post('/subscription/pay', { trxId: trxId.trim(), senderMsisdn: sender.trim(), plan: planKey });
      fbTrack('InitiateCheckout', { value: selectedPlan.price, currency: 'BDT' });
      setMsg('পেমেন্ট জমা হয়েছে। যাচাই সম্পন্ন হলে আপনার প্যাকেজে দিন যোগ হয়ে যাবে।');
      setTrxId(''); setSender('');
      await refreshSub();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'পেমেন্ট জমা দেওয়া যায়নি');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">সাবস্ক্রিপশন</h1>
      <p className="mb-5 text-sm text-muted-foreground">প্যাকেজ নবায়ন বা পরিবর্তন করুন। আপনার তথ্য সবসময় সুরক্ষিত থাকে।</p>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Current status */}
        <Card className="lg:col-span-1 self-start">
          <CardHeader><CardTitle className="text-base">বর্তমান অবস্থা</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">স্ট্যাটাস</span>
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${sub?.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {sub?.isPaid ? 'প্রো (সক্রিয়)' : 'ফ্রি প্ল্যান'}
              </span>
            </div>
            {daysLeft != null && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">বাকি আছে</span>
                <span className={`font-bold ${daysLeft <= 3 ? 'text-rose-600' : 'text-slate-900'}`}>{bn(Math.max(0, daysLeft))} দিন</span>
              </div>
            )}
            {sub?.currentPeriodEnd && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">মেয়াদ শেষ</span>
                <span>{new Date(sub.currentPeriodEnd).toLocaleDateString('bn-BD')}</span>
              </div>
            )}
            {sub?.pendingPayment && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>আপনার সর্বশেষ পেমেন্ট যাচাইয়ের অপেক্ষায় আছে।</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pick + pay */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">প্যাকেজ বেছে নিন</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PLANS.map((pl) => {
                const active = pl.key === planKey;
                return (
                  <button type="button" key={pl.key} onClick={() => setPlanKey(pl.key)}
                    className={`relative rounded-lg border p-3 text-center transition-colors ${active ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-400' : 'border-slate-200 hover:bg-slate-50'}`}>
                    {active && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-teal-600" />}
                    {pl.best && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-white">সেরা মূল্য</span>}
                    <p className="text-xs font-medium text-teal-700">{pl.label}</p>
                    <p className="text-[11px] font-medium text-slate-400 line-through">৳{bn(pl.oldPrice)}</p>
                    <p className="text-lg font-extrabold text-foreground">৳{bn(pl.price)}</p>
                    <p className="text-[10px] text-muted-foreground">৳{bn(perMonth(pl))}/মাস</p>
                    {savings(pl) > 0 && <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">৳{bn(savings(pl))} সাশ্রয়</p>}
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg bg-teal-50 p-3 ring-1 ring-teal-100">
              <p className="mb-1 text-xs font-medium text-teal-800">
                <b>{selectedPlan.label}</b> প্যাকেজের জন্য পাঠান{' '}
                <span className="text-base font-extrabold text-teal-900">৳{bn(selectedPlan.price)}</span>
              </p>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: '#e2136e' }}>bKash</span>
                <span className="inline-flex items-center rounded-md px-2 py-0.5 font-extrabold text-white" style={{ background: '#8c3494' }}>Rocket</span>
                <span className="text-muted-foreground">Send Money:</span>
              </div>
              <CopyNumber number={bkash} />
            </div>

            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li><span className="font-semibold text-foreground">৳{bn(selectedPlan.price)}</span> পাঠান <span className="font-mono font-semibold text-foreground">{bkash}</span> নম্বরে (Send Money)</li>
              <li>কনফার্মেশন SMS থেকে Transaction ID (TrxID) কপি করুন</li>
              <li>নিচে বসিয়ে জমা দিন — যাচাইয়ের পর দিন যোগ হবে</li>
            </ol>

            <form onSubmit={submit} className="space-y-3">
              <div><Label>বিকাশ Transaction ID (আবশ্যক)</Label><Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="যেমন 9AB7CD2EF1" /></div>
              <div><Label>আপনার বিকাশ নম্বর (ঐচ্ছিক)</Label><Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" /></div>
              {error && <p className="text-sm text-danger">{error}</p>}
              {msg && <p className="text-sm text-emerald-600">{msg}</p>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? 'জমা হচ্ছে…' : 'পেমেন্ট জমা দিন'}</Button>
            </form>

            {whatsapp && (
              <a href={`https://wa.me/88${whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-sm text-emerald-600 hover:underline">
                <MessageCircle className="h-4 w-4" /> সাপোর্ট (WhatsApp): {whatsapp}
              </a>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
