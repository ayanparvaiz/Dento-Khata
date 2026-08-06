import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, PasswordInput } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ToothIcon } from '@/components/ToothLogo';
import { SUPPORT_PHONE } from '@/lib/links';
import { KeyRound, ShieldCheck } from 'lucide-react';

interface Clinic { clinicName: string; drName: string; phone: string }

// Offline first-run: activate the license key (binds this PC), then the doctor sets a
// password → the clinic + owner account are created and we log straight in.
export function LicenseSetup() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'key' | 'password'>('key');
  const [key, setKey] = useState('');
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post<Clinic>('/offline/license/activate', { key: key.trim() });
      setClinic(data); setStep('password');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'কী যাচাই করা যায়নি।');
    } finally { setBusy(false); }
  };

  const complete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।'); return; }
    if (password !== confirm) { setError('দুটি পাসওয়ার্ড মিলছে না।'); return; }
    setBusy(true); setError('');
    try {
      const { data } = await api.post<{ phone: string }>('/offline/license/complete', { password });
      await login(data.phone, password); // straight into the app
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'সেটআপ সম্পন্ন করা যায়নি।');
    } finally { setBusy(false); }
  };

  return (
    <div className="grid h-full place-items-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ToothIcon className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Dento Khata — অফলাইন</h1>
            <p className="text-sm text-muted-foreground">
              {step === 'key' ? 'শুরু করতে আপনার লাইসেন্স কী দিন' : 'শেষ ধাপ — একটি পাসওয়ার্ড সেট করুন'}
            </p>
          </div>

          {step === 'key' ? (
            <form onSubmit={activate} className="space-y-4">
              <div>
                <Label>লাইসেন্স কী</Label>
                <Input value={key} autoFocus placeholder="DENTO-XXXX-XXXX-XXXX"
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  className="text-center font-mono tracking-wider" />
                <p className="mt-1 text-xs text-muted-foreground">সফটওয়্যার কেনার সময় যে কী পেয়েছেন সেটি লিখুন।</p>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                <KeyRound className="mr-1.5 h-4 w-4" /> {busy ? 'যাচাই হচ্ছে…' : 'যাচাই করুন'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">প্রথমবার চালু করতে একবার ইন্টারনেট লাগবে।</p>
              <div className="mt-1 rounded-lg bg-slate-50 p-2.5 text-center text-xs text-slate-600 ring-1 ring-slate-100">
                সমস্যা হলে সাপোর্টে যোগাযোগ করুন —{' '}
                <a href={`https://wa.me/88${SUPPORT_PHONE}`} target="_blank" rel="noreferrer" className="font-semibold text-emerald-600 hover:underline">{SUPPORT_PHONE}</a>{' '}
                (WhatsApp)
              </div>
            </form>
          ) : (
            <form onSubmit={complete} className="space-y-4">
              <div className="rounded-lg bg-teal-50 p-3 text-center text-sm ring-1 ring-teal-100">
                <div className="font-semibold text-teal-800">স্বাগতম, {clinic?.drName} 👋</div>
                <div className="text-teal-700">{clinic?.clinicName}</div>
                <div className="mt-1 text-xs text-muted-foreground">লগইন নম্বর: <b className="font-mono">{clinic?.phone}</b></div>
              </div>
              <div><Label>নতুন পাসওয়ার্ড</Label><PasswordInput value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" /></div>
              <div><Label>পাসওয়ার্ড আবার লিখুন</Label><PasswordInput value={confirm} autoComplete="new-password" onChange={(e) => setConfirm(e.target.value)} /></div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> {busy ? 'তৈরি হচ্ছে…' : 'শুরু করুন'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
