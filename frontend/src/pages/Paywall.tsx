import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, LogOut, CheckCircle2, MessageCircle, Copy, Check } from 'lucide-react';
import { fbTrack } from '@/lib/meta';

// Package options (must match the landing page).
const PLANS = [
  { label: '১ মাস', price: '৳১,৯৯০', per: '৳১,৯৯০/মাস', save: '' },
  { label: '৬ মাস', price: '৳১০,৯৯০', per: '৳১,৮৩২/মাস', save: '৳৯৫০ সাশ্রয়' },
  { label: '১২ মাস', price: '৳১৯,৯৯০', per: '৳১,৬৬৬/মাস', save: 'সেরা মূল্য' },
];

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

// Shown when the clinic's subscription is inactive (PENDING / expired / suspended).
// Phase 1 billing = manual bKash: the clinic Sends Money and submits the TrxID for verification.
export function Paywall() {
  const { user, sub, logout, refreshSub } = useAuth();
  const [trxId, setTrxId] = useState('');
  const [sender, setSender] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const doRefresh = async () => {
    setChecking(true);
    setRefreshMsg('');
    const s = await refreshSub();
    setChecking(false);
    // If it became active, this component unmounts (app opens). Otherwise show why.
    if (s && !s.active) {
      setRefreshMsg(
        s.status === 'SUSPENDED'
          ? 'অ্যাকাউন্ট এখনও স্থগিত আছে।'
          : 'এখনও সক্রিয় হয়নি। পেমেন্ট যাচাই সম্পন্ন হলে স্বয়ংক্রিয়ভাবে চালু হবে।',
      );
    }
  };

  const amount = sub?.amount ?? 1990;
  const bkash = sub?.bkashNumber ?? '—';
  const whatsapp = sub?.whatsapp || '';
  const suspended = sub?.status === 'SUSPENDED';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxId.trim()) {
      setError('অনুগ্রহ করে Transaction ID দিন — এটি ছাড়া এগোনো যাবে না');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api.post('/subscription/pay', { trxId: trxId.trim(), senderMsisdn: sender.trim() });
      fbTrack('InitiateCheckout', { value: amount, currency: 'BDT' }); // paid, awaiting verification
      setMsg('পেমেন্ট জমা হয়েছে। যাচাই হলে আপনার ক্লিনিক স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে — এই পেজ খোলা রাখুন।');
      setTrxId('');
      setSender('');
      await refreshSub();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'পেমেন্ট জমা দেওয়া যায়নি');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 pt-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">
              {suspended ? 'অ্যাকাউন্ট স্থগিত' : 'সাবস্ক্রিপশন চালু করুন'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user?.tenant?.name ? `${user.tenant.name} — ` : ''}
              {suspended
                ? 'আপনার ক্লিনিক অ্যাকাউন্ট স্থগিত করা হয়েছে। সাপোর্টে যোগাযোগ করুন।'
                : `অ্যাপ ব্যবহার করতে সক্রিয় সাবস্ক্রিপশন প্রয়োজন (৳${amount}/মাস)।`}
            </p>
          </div>

          {sub?.pendingPayment && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
              <span>আপনার সর্বশেষ পেমেন্ট যাচাইয়ের অপেক্ষায় আছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।</span>
            </div>
          )}

          {!suspended && (
            <>
              <div className="rounded-lg border bg-card p-4 text-sm">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">প্যাকেজ বেছে নিন — Send Money</span>
                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white" style={{ background: '#e2136e' }}>bKash</span>
                  <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white" style={{ background: '#8c3494' }}>Rocket</span>
                </div>

                {/* Package table so the user doesn't need to go back to the landing page */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {PLANS.map((pl) => (
                    <div key={pl.label} className="rounded-lg border border-teal-100 bg-teal-50/60 p-2 text-center">
                      <p className="text-xs text-teal-700">{pl.label}</p>
                      <p className="text-base font-extrabold text-foreground">{pl.price}</p>
                      <p className="text-[10px] text-muted-foreground">{pl.per}</p>
                      {pl.save && <p className="mt-0.5 text-[10px] font-semibold text-emerald-600">{pl.save}</p>}
                    </div>
                  ))}
                </div>

                {/* Copyable number */}
                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">আমাদের বিকাশ / রকেট নম্বর (Send Money)</p>
                  <CopyNumber number={bkash} />
                </div>

                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>
                    আপনার প্যাকেজের টাকা পাঠান{' '}
                    <span className="font-mono font-semibold text-foreground">{bkash}</span> নম্বরে
                    (Send Money)
                  </li>
                  <li>কনফার্মেশন SMS থেকে Transaction ID (TrxID) কপি করুন</li>
                  <li>নিচে সেটি বসিয়ে জমা দিন — যাচাইয়ের পর অ্যাকাউন্ট চালু হবে</li>
                </ol>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>বিকাশ Transaction ID (আবশ্যক)</Label>
                  <Input value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="যেমন 9AB7CD2EF1" />
                </div>
                <div>
                  <Label>আপনার বিকাশ নম্বর (ঐচ্ছিক)</Label>
                  <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                {msg && <p className="text-sm text-emerald-600">{msg}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'জমা হচ্ছে…' : 'পেমেন্ট জমা দিন'}
                </Button>
              </form>
            </>
          )}

          {whatsapp && (
            <a
              href={`https://wa.me/88${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm text-emerald-600 hover:underline"
            >
              <MessageCircle className="h-4 w-4" /> সাপোর্ট (WhatsApp): {whatsapp}
            </a>
          )}

          {refreshMsg && <p className="text-center text-sm text-amber-600">{refreshMsg}</p>}

          <div className="flex items-center justify-between border-t pt-3 text-sm">
            <button onClick={doRefresh} disabled={checking} className="text-primary hover:underline disabled:opacity-50">
              {checking ? 'দেখা হচ্ছে…' : 'স্ট্যাটাস রিফ্রেশ'}
            </button>
            <button onClick={logout} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <LogOut className="h-3.5 w-3.5" /> লগ আউট
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
