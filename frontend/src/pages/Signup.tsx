import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Stethoscope, Check, MessageCircle } from 'lucide-react';

const BKASH = '01609314106';
const WHATSAPP = '01992147963';

const FEATURES = [
  'রোগীর সম্পূর্ণ তথ্য ও চিকিৎসার ইতিহাস',
  'অ্যাপয়েন্টমেন্ট ক্যালেন্ডার (সাপ্তাহিক/মাসিক ভিউ)',
  'ডেন্টাল চার্ট ও দাঁতের অবস্থা রেকর্ড',
  'চিকিৎসা পরিকল্পনা ও ভিজিট অনুযায়ী রেকর্ড',
  'বাংলা প্রেসক্রিপশন (৮,৯০০+ ওষুধের তালিকা)',
  'বিলিং, পেমেন্ট ও ইনভয়েস প্রিন্ট',
  'আয়ের রিপোর্ট ও ড্যাশবোর্ড',
  'একাধিক ইউজার (ডাক্তার + রিসেপশনিস্ট) অ্যাক্সেস',
  'এক্স-রে ও ছবি আপলোড',
  'প্রতিদিন স্বয়ংক্রিয় ডেটা ব্যাকআপ',
];

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ clinicName: '', ownerName: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup({ ...f, phone: f.phone.trim() });
      navigate('/'); // lands on the paywall (new clinics start unpaid)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'অ্যাকাউন্ট তৈরি করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-teal-50 via-white to-slate-50">
      <div className="mx-auto grid max-w-5xl gap-8 p-4 py-10 md:grid-cols-2 md:p-8 md:py-16">
        {/* Left: marketing + pricing (below the form on mobile) */}
        <div className="order-2 space-y-6 md:order-1">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">ডেন্টাল ক্লিনিক ম্যানেজার</h1>
              <p className="text-sm text-muted-foreground">আপনার চেম্বারের সম্পূর্ণ ডিজিটাল সমাধান</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-teal-700">মাসিক প্যাকেজ</p>
            <p className="mt-1 flex items-end gap-1">
              <span className="text-4xl font-extrabold">৳৯৯০</span>
              <span className="pb-1 text-muted-foreground">/ মাস</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              এক ক্লিনিকের সব ইউজার। কোনো সেটআপ ফি নেই। যেকোনো সময় বাতিল করা যাবে।
            </p>
          </div>

          <ul className="grid gap-2">
            {FEATURES.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 flex-none text-teal-600" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-slate-900 p-5 text-sm text-slate-100">
            <p className="mb-2 font-semibold">কীভাবে শুরু করবেন</p>
            <ol className="list-decimal space-y-1 pl-5 text-slate-300">
              <li>ফর্মে আপনার তথ্য দিয়ে অ্যাকাউন্ট তৈরি করুন</li>
              <li>
                বিকাশ/রকেটে <span className="font-mono font-semibold text-white">{BKASH}</span> নম্বরে{' '}
                <span className="font-semibold text-white">Send Money</span> করে ৳৯৯০ পাঠান
              </li>
              <li>Transaction ID টি অ্যাপে জমা দিন</li>
              <li>পেমেন্ট যাচাই হলে আপনার অ্যাকাউন্ট চালু হয়ে যাবে</li>
            </ol>
            <a
              href={`https://wa.me/88${WHATSAPP}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-emerald-400 hover:underline"
            >
              <MessageCircle className="h-4 w-4" /> সাপোর্ট (WhatsApp): {WHATSAPP}
            </a>
          </div>
        </div>

        {/* Right: signup form (on top on mobile so users reach it first) */}
        <div className="order-1 md:order-2 md:pt-4">
          <Card className="md:sticky md:top-8">
            <CardContent className="space-y-4 pt-8">
              <div>
                <h2 className="text-lg font-bold">অ্যাকাউন্ট তৈরি করুন</h2>
                <p className="text-sm text-muted-foreground">১ মিনিটেই শুরু করুন</p>
              </div>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>ক্লিনিকের নাম</Label>
                  <Input value={f.clinicName} onChange={set('clinicName')} placeholder="স্মাইল ডেন্টাল কেয়ার" autoFocus />
                </div>
                <div>
                  <Label>মালিক/ডাক্তারের নাম</Label>
                  <Input value={f.ownerName} onChange={set('ownerName')} placeholder="ডাঃ ..." />
                </div>
                <div>
                  <Label>ফোন নম্বর (এটি দিয়েই লগইন হবে)</Label>
                  <Input value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" inputMode="tel" />
                </div>
                <div>
                  <Label>পাসওয়ার্ড</Label>
                  <Input type="password" value={f.password} onChange={set('password')} placeholder="কমপক্ষে ৬ অক্ষর" />
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? 'তৈরি হচ্ছে…' : 'অ্যাকাউন্ট তৈরি করুন'}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                আগে থেকে অ্যাকাউন্ট আছে?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  সাইন ইন করুন
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
