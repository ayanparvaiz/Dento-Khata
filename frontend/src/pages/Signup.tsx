import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, PasswordInput } from '@/components/ui/input';
import { fbTrack } from '@/lib/meta';
import { startVisitTracking, markVisitSignup } from '@/lib/visitTracker';
import { PLANS, bn, perMonth, savings } from '@/lib/pricing';
import { Check, MessageCircle, AlertTriangle, ArrowRight, Copy, X } from 'lucide-react';
import { ToothIcon } from '@/components/ToothLogo';

const BKASH = '01992147963';
const WHATSAPP = '01992147963';

// Real dental photos (swap for your own any time). Gradient overlays keep text readable
// and show even if a photo fails to load.
const IMG = {
  hero: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1600&q=80',
  banner: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1600&q=80',
  cta: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80',
};

// Colourful designed asset icons (Iconify CDN — fluent-emoji-flat set). Not flat line icons.
const AssetIcon = ({ name, className = 'h-10 w-10' }: { name: string; className?: string }) => (
  <img src={`https://api.iconify.design/fluent-emoji-flat/${name}.svg`} alt="" loading="lazy" className={className} />
);

// Payment brand chips in the official brand colours (bKash pink, Rocket purple).
const PayLogo = ({ name, bg }: { name: string; bg: string }) => (
  <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-extrabold tracking-tight text-white shadow-sm" style={{ background: bg }}>{name}</span>
);

// Tap-to-copy number chip (dark = on dark backgrounds).
function CopyNumber({ number, dark = false }: { number: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(number)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })
      .catch(() => {});
  };
  return (
    <button
      type="button" onClick={copy}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-base font-bold ${dark ? 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20' : 'bg-teal-50 text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100'}`}
      title="নম্বর কপি করুন"
    >
      {number}
      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 opacity-80" />}
      <span className="text-xs font-sans font-medium opacity-90">{copied ? 'কপি হয়েছে ✓' : 'কপি'}</span>
    </button>
  );
}

// Pricing packages come from the shared catalog (lib/pricing.ts) so every screen matches.

// Background photo layer with graceful fallback (hides itself if the image fails).
function PhotoBg({ src, className = 'opacity-25' }: { src: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) return null;
  return <img src={src} alt="" loading="lazy" onError={() => setErr(true)} className={`absolute inset-0 -z-10 h-full w-full object-cover ${className}`} />;
}

const PROBLEMS = [
  'কাগজের ফাইল হারিয়ে যায় — পুরনো রোগীর ইতিহাস খুঁজে পাওয়া যায় না',
  'কে কবে আসবে মনে থাকে না, অ্যাপয়েন্টমেন্ট মিস হয়',
  'কে কত টাকা বাকি রাখল — সঠিক হিসাব থাকে না',
  'হাতে প্রেসক্রিপশন লিখতে প্রতিদিন অনেক সময় নষ্ট হয়',
  'মাস শেষে আসলে কত আয় হলো, বোঝা যায় না',
  'ডেটা এক জায়গায় না থাকায় রিসেপশন ও ডাক্তারের মধ্যে ঝামেলা',
];

const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: 'busts-in-silhouette', title: 'রোগী ব্যবস্থাপনা', desc: 'প্রতিটি রোগীর সম্পূর্ণ তথ্য, মেডিকেল হিস্ট্রি ও ছবি এক জায়গায়' },
  { icon: 'calendar', title: 'অ্যাপয়েন্টমেন্ট ক্যালেন্ডার', desc: 'সাপ্তাহিক/মাসিক ভিউ, কে এলো কে এলো না — রঙে বোঝা যায়' },
  { icon: 'tooth', title: 'ডেন্টাল চার্ট', desc: 'দাঁতের অবস্থা ছবির মতো চার্টে মার্ক করুন (Palmer/FDI)' },
  { icon: 'pill', title: 'বাংলা প্রেসক্রিপশন', desc: '৮,৯০০+ ওষুধের তালিকা, এক ক্লিকে প্রিন্ট, চার্টসহ' },
  { icon: 'money-bag', title: 'বিলিং ও পেমেন্ট', desc: 'কে কত দিল, কত বাকি — নিখুঁত হিসাব ও ইনভয়েস' },
  { icon: 'bar-chart', title: 'আয়ের রিপোর্ট', desc: 'দৈনিক/মাসিক আয়, ড্যাশবোর্ডে এক নজরে সব' },
];

const TRUST: { icon: string; title: string; desc: string }[] = [
  { icon: 'cloud', title: 'কিছুই হারাবে না', desc: 'প্রতিদিন স্বয়ংক্রিয় ব্যাকআপ — আপনার ডেটা সবসময় নিরাপদ ও গোপন' },
  { icon: 'mobile-phone', title: 'যেকোনো ডিভাইসে', desc: 'মোবাইল, ট্যাব, কম্পিউটার — সব জায়গা থেকে চেম্বার সামলান' },
  { icon: 'speech-balloon', title: 'বাংলায় সাপোর্ট', desc: 'সরাসরি WhatsApp-এ সাহায্য, যখন দরকার' },
  { icon: 'rocket', title: '১ মিনিটে শুরু', desc: 'কোনো সেটআপ ফি নেই — সাইন আপ করেই ব্যবহার শুরু করুন' },
];

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ clinicName: '', ownerName: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [heroErr, setHeroErr] = useState(false); // fall back to gradient if the hero photo fails

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  // Measure landing-page engagement (time on page + scroll depth) for the super-admin.
  useEffect(() => startVisitTracking(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup({ ...f, phone: f.phone.trim() });
      markVisitSignup(); // this visit converted
      navigate('/'); // lands on the paywall
    } catch (err: any) {
      setError(err?.response?.data?.message || 'অ্যাকাউন্ট তৈরি করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const scrollToForm = () => {
    fbTrack('ViewContent', { content_name: 'pricing_cta' });
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-white text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
        <a href="#top" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ToothIcon className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">Dento Khata</span>
        </a>

        {/* Desktop section nav (hidden on mobile) */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition-colors hover:text-primary">ফিচার</a>
          <a href="#trust" className="transition-colors hover:text-primary">কেন আমরা</a>
          <a href="#pricing" className="transition-colors hover:text-primary">মূল্য</a>
          <a href="#signup" className="transition-colors hover:text-primary">যোগাযোগ</a>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login" className="inline-flex h-9 items-center rounded-lg border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5">
            লগইন
          </Link>
          <button onClick={scrollToForm} className="hidden h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary/90 sm:inline-flex">
            শুরু করুন
          </button>
        </div>
      </header>

      {/* Hero — real photo layer + brand gradient overlay (gradient shows even if the photo fails) */}
      <section id="top" className="relative isolate overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-500 px-4 py-16 text-white md:px-8 md:py-28">
        {!heroErr && (
          <img
            src={IMG.hero}
            alt=""
            onError={() => setHeroErr(true)}
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60"
          />
        )}
        {/* gradient wash — soft black-green tint over the photo (photo still shows through) */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-black/55 via-teal-950/45 to-emerald-900/40" />
        <div className="absolute inset-0 -z-10 bg-emerald-950/20" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            🇧🇩 বাংলাদেশের ডেন্টিস্টদের জন্য তৈরি
          </span>
          <h1 className="mt-5 text-[28px] font-extrabold leading-[1.15] tracking-tight sm:text-4xl md:text-5xl">
            আপনার ডেন্টাল চেম্বারের<br className="hidden sm:block" /> সম্পূর্ণ ডিজিটাল সমাধান
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-teal-50/90 md:text-lg">
            রোগীর তথ্য, অ্যাপয়েন্টমেন্ট, প্রেসক্রিপশন, বিলিং — সব এক জায়গায়।
            কাগজের ঝামেলা শেষ, <span className="font-semibold text-white">কিছুই হারাবে না।</span>
          </p>
          <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center">
            <Button onClick={scrollToForm} className="h-12 bg-white px-6 text-base font-semibold text-primary shadow-lg shadow-teal-900/20 hover:bg-teal-50">
              অ্যাকাউন্ট তৈরি করুন <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <a href={`https://wa.me/88${WHATSAPP}`} target="_blank" rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-6 text-base font-medium hover:bg-white/10">
              <MessageCircle className="h-4 w-4" /> কথা বলুন
            </a>
          </div>

          {/* Highlighted service promises */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 text-sm font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 ring-1 ring-white/25">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" /><span className="inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span>
              ২৪/৭ সাপোর্ট
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 ring-1 ring-white/25">🔄 নিয়মিত নতুন আপডেট</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 ring-1 ring-white/25">☁️ প্রতিদিন ব্যাকআপ</span>
          </div>
        </div>
      </section>

      {/* Signup form — placed high (right after the hero) so visitors can register
          immediately instead of scrolling to the bottom. */}
      <section id="signup" className="relative isolate scroll-mt-20 overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 px-4 py-14 md:px-8 md:py-16">
        <PhotoBg src={IMG.cta} className="opacity-40" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-teal-800/55 to-emerald-700/45" />
        <div className="relative mx-auto max-w-md">
          <div className="mb-5 text-center text-white">
            <h2 className="text-2xl font-bold md:text-3xl">আজই আপনার ক্লিনিক ডিজিটাল করুন</h2>
            <p className="mt-2 text-sm text-teal-50/90">১ মিনিটেই অ্যাকাউন্ট তৈরি করুন — কোনো সেটআপ ফি নেই।</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={submit} className="space-y-3">
              <div><Label>ক্লিনিকের নাম</Label><Input value={f.clinicName} onChange={set('clinicName')} placeholder="স্মাইল ডেন্টাল কেয়ার" /></div>
              <div><Label>মালিক / ডাক্তারের নাম</Label><Input value={f.ownerName} onChange={set('ownerName')} placeholder="ডাঃ ..." /></div>
              <div><Label>ফোন নম্বর (এটি দিয়েই লগইন হবে)</Label><Input value={f.phone} onChange={set('phone')} placeholder="01XXXXXXXXX" inputMode="tel" /></div>
              <div><Label>পাসওয়ার্ড</Label><PasswordInput value={f.password} onChange={set('password')} placeholder="কমপক্ষে ৬ অক্ষর" /></div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
                {busy ? 'তৈরি হচ্ছে…' : 'অ্যাকাউন্ট তৈরি করুন'}
              </Button>
              <p className="text-center text-xs text-slate-400">অ্যাকাউন্ট তৈরি করে আপনি আমাদের শর্তাবলীতে সম্মত হচ্ছেন।</p>
            </form>
            <p className="mt-3 text-center text-sm text-slate-500">
              আগে থেকে অ্যাকাউন্ট আছে?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">সাইন ইন করুন</Link>
            </p>
          </div>

          {/* Trust + contact */}
          <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs text-white/90">
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">🔒 তথ্য ১০০% নিরাপদ ও গোপন</span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">☁️ প্রতিদিন ব্যাকআপ</span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20">🇧🇩 বাংলায় সাপোর্ট</span>
          </div>

          <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-white/10 p-5 text-center text-white ring-1 ring-white/20 backdrop-blur">
            <p className="font-semibold">প্রশ্ন আছে? সরাসরি কথা বলুন</p>
            <p className="mt-1 text-sm text-teal-50/80">সেটআপ থেকে দৈনন্দিন ব্যবহার — যেকোনো প্রয়োজনে আমাদের টিম আপনার পাশে।</p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <a href={`https://wa.me/88${WHATSAPP}`} target="_blank" rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600">
                <MessageCircle className="h-5 w-5" /> WhatsApp-এ মেসেজ দিন
              </a>
              <CopyNumber number={WHATSAPP} dark />
            </div>
            <p className="mt-4 text-xs text-teal-50/70">🇧🇩 বাংলাদেশের ডেন্টিস্টদের বিশ্বস্ত সঙ্গী</p>
          </div>
        </div>
      </section>

      {/* Problems */}
      <section className="px-4 py-14 md:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">চেম্বার চালাতে এই সমস্যাগুলো কি চেনা লাগে?</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-500">প্রতিদিনের ছোট ছোট ঝামেলাই বড় ক্ষতির কারণ হয়।</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {PROBLEMS.map((p) => (
              <div key={p} className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-rose-500" />
                <span className="text-sm text-slate-700">{p}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solution / features */}
      <section id="features" className="scroll-mt-20 bg-slate-50 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">একটি সমাধান — সবকিছুর জন্য</h2>
            <p className="mt-3 text-slate-600">
              এটি শুধু একটি সফটওয়্যার নয় — আপনার চেম্বারের <span className="font-semibold text-primary">পূর্ণাঙ্গ সমাধান</span>।
              প্রতিটি রোগীর তথ্য, চিকিৎসা ও পেমেন্ট নিরাপদে সংরক্ষিত থাকে — <span className="font-semibold">কিছুই হারায় না।</span>
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 ring-1 ring-teal-100">
                  <AssetIcon name={icon} className="h-9 w-9" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="scroll-mt-20 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">কেন ডেন্টিস্টরা আমাদের বিশ্বাস করেন</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map(({ icon, title, desc }) => (
              <div key={title} className="rounded-2xl bg-slate-50 p-5 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
                  <AssetIcon name={icon} className="h-9 w-9" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value banner — photo + gradient overlay */}
      <section className="relative isolate overflow-hidden px-4 py-16 text-center text-white md:px-8 md:py-20">
        <PhotoBg src={IMG.banner} className="opacity-100" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-teal-900/70 via-teal-800/55 to-emerald-800/55" />
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold leading-snug md:text-3xl">
            এটি শুধু একটি সফটওয়্যার নয় —<br className="hidden sm:block" /> আপনার চেম্বারের বিশ্বস্ত সঙ্গী
          </h2>
          <p className="mt-3 text-teal-50/90">
            প্রতিটি রোগী, প্রতিটি ভিজিট, প্রতিটি টাকা — সবকিছু নিরাপদে সংরক্ষিত। কিছুই হারায় না, কিছুই ভুলে যায় না।
          </p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 bg-slate-50 px-4 py-14 md:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">সহজ, সাশ্রয়ী মূল্য</h2>
          <p className="mt-2 text-center text-slate-500">এক ক্লিনিকের সব ইউজার · আনলিমিটেড রোগী · কোনো সেটআপ ফি নেই</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {PLANS.map((pl) => (
              <div key={pl.key} className={`relative rounded-2xl bg-white p-5 text-center shadow-sm ${pl.best ? 'border-2 border-primary shadow-md' : 'border border-slate-100'}`}>
                {pl.best && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">সেরা মূল্য · ২ মাস সাশ্রয়</span>}
                <p className="text-sm font-medium text-teal-700">{pl.label}</p>
                <p className="mt-1 text-sm font-medium text-slate-400 line-through">৳{bn(pl.oldPrice)}</p>
                <p className="text-3xl font-extrabold text-slate-900">৳{bn(pl.price)}</p>
                <p className="mt-0.5 text-xs text-slate-500">৳{bn(perMonth(pl))} / মাস</p>
                {savings(pl) > 0 && <p className="mt-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">৳{bn(savings(pl))} সাশ্রয়</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <ul className="grid gap-2 sm:grid-cols-2">
              {['রোগী, অ্যাপয়েন্টমেন্ট ও রেকর্ড', 'বাংলা প্রেসক্রিপশন + ডেন্টাল চার্ট', 'বিলিং, ইনভয়েস ও রিপোর্ট', 'একাধিক ইউজার', 'প্রতিদিন ব্যাকআপ', 'WhatsApp সাপোর্ট'].map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm"><Check className="mt-0.5 h-4 w-4 flex-none text-teal-600" /> <span>{t}</span></li>
              ))}
            </ul>
            <div className="mt-5 rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-semibold">Send Money করুন</span>
                <PayLogo name="bKash" bg="#e2136e" />
                <PayLogo name="Rocket" bg="#8c3494" />
              </div>
              <p className="mb-1 text-xs font-medium text-slate-400">আমাদের বিকাশ / রকেট নম্বর</p>
              <CopyNumber number={BKASH} dark />
              <p className="mt-3 text-slate-300">
                অ্যাকাউন্ট তৈরি করুন → উপরের নম্বরে Send Money → Transaction ID জমা দিন → অ্যাকাউন্ট চালু।
              </p>
              <a href={`https://wa.me/88${WHATSAPP}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-emerald-400 hover:underline">
                <MessageCircle className="h-4 w-4" /> সাপোর্ট: {WHATSAPP}
              </a>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button onClick={scrollToForm} className="h-11 px-8 text-base">আজই শুরু করুন <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 px-4 py-8 text-center text-sm text-slate-500 md:px-8">
        <div className="flex items-center justify-center gap-2 font-semibold text-slate-700">
          <ToothIcon className="h-5 w-5 text-primary" /> Dento Khata
        </div>
        <p className="mt-2">বাংলাদেশের ডেন্টাল চেম্বারের জন্য তৈরি · সাপোর্ট: <a className="text-primary hover:underline" href={`https://wa.me/88${WHATSAPP}`}>{WHATSAPP}</a></p>
      </footer>

      <WhatsAppFab />
    </div>
  );
}

// Floating WhatsApp button — one tap to support from anywhere on the page.
// Sits above the sign-up form's bottom padding so it never covers the submit button.
const WA_ICON = (
  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" />
    <path d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22.5l5.85-1.53a9.83 9.83 0 0 0 4.19.94h.01c5.43 0 9.86-4.43 9.86-9.87 0-2.64-1.03-5.12-2.89-6.98A9.8 9.8 0 0 0 12.04 2zm0 17.96h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.35c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.19-8.2 8.19z" />
  </svg>
);

// Floating WhatsApp button: a pulsing "radar" ring draws the eye, and after a couple of
// seconds a small greeting bubble pops up (dismissible) so first-time visitors — who may
// not know what "Sign Up" means — realise they can just message a human.
function WhatsAppFab() {
  const msg = encodeURIComponent('আসসালামু আলাইকুম, Dento Khata সম্পর্কে জানতে চাই।');
  const href = `https://wa.me/88${WHATSAPP}?text=${msg}`;
  const [bubble, setBubble] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBubble(true), 2500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-2 md:bottom-6 md:right-6">
      {/* Attention greeting bubble */}
      {bubble && (
        <div className="animate-fade-in-up flex max-w-[15rem] items-start gap-2 rounded-2xl rounded-br-sm bg-white p-3 shadow-xl ring-1 ring-black/5">
          <a href={href} target="_blank" rel="noreferrer" onClick={() => fbTrack('Contact', { method: 'whatsapp' })} className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">সাহায্য লাগবে? 👋</span>
            <br />সরাসরি WhatsApp-এ আমাদের জিজ্ঞাসা করুন — সাইন আপ না বুঝলেও সমস্যা নেই।
          </a>
          <button onClick={() => setBubble(false)} aria-label="বন্ধ করুন" className="-mr-1 -mt-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* The button + pulsing ring */}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={() => fbTrack('Contact', { method: 'whatsapp' })}
        aria-label="WhatsApp-এ যোগাযোগ করুন"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-700/30 transition-transform hover:scale-110"
      >
        {/* radar pulse */}
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-60" />
        <span className="absolute inset-0 -z-10 rounded-full bg-[#25D366]" />
        {/* online dot */}
        <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-[#25D366] bg-white">
          <span className="absolute inset-0.5 rounded-full bg-emerald-400" />
        </span>
        {WA_ICON}
      </a>
    </div>
  );
}
