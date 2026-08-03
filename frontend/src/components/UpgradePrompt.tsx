import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Small "প্রো" badge to mark a Pro-only feature in nav/labels.
export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ${className}`}>
      <Sparkles className="h-2.5 w-2.5" /> প্রো
    </span>
  );
}

// Full-panel upgrade card shown in place of a locked (Pro-only) feature.
export function UpgradeCard({ title, desc }: { title: string; desc: string }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50/60 p-8 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
        <Lock className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600">{desc}</p>
      <p className="mt-1 text-xs text-slate-500">এটি প্রো সাবস্ক্রিপশনের ফিচার।</p>
      <Button className="mt-5 h-11 px-6" onClick={() => navigate('/subscribe')}>
        <Sparkles className="mr-1.5 h-4 w-4" /> প্রো-তে আপগ্রেড করুন
      </Button>
    </div>
  );
}

// Inline banner (smaller) for gating a button/section within a page.
export function UpgradeInline({ text }: { text: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/subscribe')}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100"
    >
      <span className="flex items-center gap-2 text-sm text-amber-900"><Lock className="h-4 w-4 flex-none" /> {text}</span>
      <span className="flex flex-none items-center gap-1 text-sm font-semibold text-amber-700"><Sparkles className="h-4 w-4" /> আপগ্রেড</span>
    </button>
  );
}
