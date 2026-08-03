import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PartyPopper, Check, Sparkles } from 'lucide-react';

// Advanced features that need Pro (shown in the welcome dialog).
const PRO_FEATURES = [
  'আনলিমিটেড রোগী (ফ্রি-তে ১০০ পর্যন্ত)',
  'একাধিক ইউজার — রিসেপশনিস্ট/অ্যাসিস্ট্যান্ট',
  'আয়ের রিপোর্ট ও অ্যানালিটিক্স',
  'ইনভয়েস ও স্টেটমেন্ট প্রিন্ট',
  'X-ray / ছবি সংরক্ষণ',
  'নিজের লোগো ও লেটারহেড',
  'প্রতিদিন ব্যাকআপ',
];

// One-time welcome dialog, shown right after signup. Tells the doctor the software is
// FREE to use, and lists the advanced features that Pro unlocks.
export function TrialWelcome() {
  const navigate = useNavigate();
  const [show, setShow] = useState(() => localStorage.getItem('dk_trial_welcome') === '1');
  if (!show) return null;
  const close = () => { localStorage.removeItem('dk_trial_welcome'); setShow(false); };
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={close}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <PartyPopper className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold">স্বাগতম! সফটওয়্যারটি একদম ফ্রি 🎉</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          রোগী, অ্যাপয়েন্টমেন্ট, বাংলা প্রেসক্রিপশন, ডেন্টাল চার্ট, বেসিক বিলিং — সব
          <b className="text-teal-700"> ফ্রি-তে</b> ব্যবহার করুন। কোনো সময়সীমা নেই।
        </p>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-left">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
            <Sparkles className="h-4 w-4" /> চেম্বার বড় হলে প্রো-তে যা পাবেন
          </p>
          <ul className="space-y-1.5">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 flex-none text-amber-600" /> <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">এই অ্যাডভান্স ফিচারগুলো ব্যবহার করতে প্রো লাগবে।</p>
        </div>

        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { close(); navigate('/subscribe'); }}>প্রো দেখুন</Button>
          <Button className="flex-1" onClick={close}>ফ্রি-তে শুরু করি</Button>
        </div>
      </div>
    </div>
  );
}

// No trial in the freemium model — the banner is intentionally inert.
export function TrialBanner() {
  return null;
}
