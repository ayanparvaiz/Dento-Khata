import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Gift, PartyPopper } from 'lucide-react';

// One-time "your free trial started" dialog, shown right after signup.
export function TrialWelcome() {
  const { sub } = useAuth();
  const [show, setShow] = useState(() => localStorage.getItem('dk_trial_welcome') === '1');
  if (!show) return null;
  const close = () => { localStorage.removeItem('dk_trial_welcome'); setShow(false); };
  const days = sub?.daysLeft ?? 3;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={close}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <PartyPopper className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">আপনার ফ্রি ট্রায়াল শুরু হয়েছে! 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          আগামী <b className="text-teal-700">{days} দিন</b> সম্পূর্ণ ফ্রি — পুরো সফটওয়্যার ব্যবহার করে দেখুন।
          রোগী যোগ করুন, অ্যাপয়েন্টমেন্ট নিন, প্রেসক্রিপশন প্রিন্ট করুন — সব ফিচার খোলা।
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          ট্রায়াল শেষে সাবস্ক্রিপশন নিলেই আপনার সব তথ্য অক্ষত থাকবে।
        </p>
        <Button className="mt-5 w-full" onClick={close}>শুরু করি</Button>
      </div>
    </div>
  );
}

// Thin banner shown across the app while the clinic is on the free trial.
export function TrialBanner() {
  const { sub } = useAuth();
  const navigate = useNavigate();
  if (!sub?.isTrial || !sub.active) return null;
  const days = sub.daysLeft ?? 0;
  const urgent = days <= 1;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm ${urgent ? 'bg-amber-100 text-amber-900' : 'bg-teal-50 text-teal-800'}`}>
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Gift className="h-4 w-4" />
        ফ্রি ট্রায়াল — আর <b>{days <= 0 ? 'আজই শেষ' : `${days} দিন বাকি`}</b>
      </span>
      <button
        onClick={() => navigate('/subscribe')}
        className="rounded-full bg-teal-600 px-3 py-0.5 text-xs font-semibold text-white hover:bg-teal-700"
      >
        এখনই সাবস্ক্রাইব করুন
      </button>
    </div>
  );
}
