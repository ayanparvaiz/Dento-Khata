import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, PasswordInput } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, MessageCircle, X } from 'lucide-react';
import { ToothIcon } from '@/components/ToothLogo';

interface Suspended { message: string; whatsapp?: string }

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [suspended, setSuspended] = useState<Suspended | null>(null);

  // If an active session was killed because the clinic was disabled, show the popup on arrival.
  useEffect(() => {
    const s = sessionStorage.getItem('suspended');
    if (s) { try { setSuspended(JSON.parse(s)); } catch { /* ignore */ } sessionStorage.removeItem('suspended'); }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(phone.trim(), password);
      navigate('/');
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === 'CLINIC_SUSPENDED') {
        setSuspended({ message: data.message, whatsapp: data.whatsapp });
      } else {
        setError(data?.message || 'ফোন নম্বর বা পাসওয়ার্ড ভুল');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-full place-items-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8">
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ToothIcon className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Dento Khata</h1>
            <p className="text-sm text-muted-foreground">আপনার ক্লিনিকে সাইন ইন করুন</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>ফোন নম্বর</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" inputMode="tel" autoFocus />
            </div>
            <div>
              <Label>পাসওয়ার্ড</Label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'সাইন ইন হচ্ছে…' : 'সাইন ইন'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            নতুন ক্লিনিক?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">অ্যাকাউন্ট তৈরি করুন</Link>
          </p>
        </CardContent>
      </Card>

      {/* Suspended-clinic support popup */}
      {suspended && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSuspended(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSuspended(null)} className="ml-auto block text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="mt-3 text-lg font-bold">অ্যাকাউন্ট সাময়িকভাবে বন্ধ</h2>
            <p className="mt-2 text-sm text-slate-600">{suspended.message}</p>
            <p className="mt-1 text-xs text-slate-400">আপনার সকল তথ্য নিরাপদে সংরক্ষিত আছে।</p>
            {suspended.whatsapp && (
              <a href={`https://wa.me/88${suspended.whatsapp}`} target="_blank" rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600">
                <MessageCircle className="h-5 w-5" /> সাপোর্টে যোগাযোগ ({suspended.whatsapp})
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
