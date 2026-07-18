import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Stethoscope } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(phone.trim(), password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'ফোন নম্বর বা পাসওয়ার্ড ভুল');
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
              <Stethoscope className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">ডেন্টাল ক্লিনিক ম্যানেজার</h1>
            <p className="text-sm text-muted-foreground">আপনার ক্লিনিকে সাইন ইন করুন</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>ফোন নম্বর</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                inputMode="tel"
                autoFocus
              />
            </div>
            <div>
              <Label>পাসওয়ার্ড</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'সাইন ইন হচ্ছে…' : 'সাইন ইন'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            নতুন ক্লিনিক?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              অ্যাকাউন্ট তৈরি করুন
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
