import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboard, taka } from '@/lib/clinical';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Users, CalendarDays, CalendarRange, Stethoscope, Wallet, AlertCircle, ChevronRight, PlayCircle, X, MessageCircle } from 'lucide-react';
import { OVERVIEW_VIDEO_ID, ytThumb } from '@/lib/tutorials';
import { COMMUNITY_URL } from '@/lib/links';

const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const STATUS_TONE: Record<string, string> = {
  BOOKED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-sky-100 text-sky-700',
  ARRIVED: 'bg-amber-100 text-amber-700',
  IN_CHAIR: 'bg-violet-100 text-violet-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
  NO_SHOW: 'bg-red-100 text-red-700',
};

// Soft, distinct colour per KPI — colourful but calm.
const TONES: Record<string, { card: string; icon: string; val: string; ring: string }> = {
  primary: { card: 'bg-teal-50', icon: 'bg-teal-500', val: 'text-teal-700', ring: 'hover:ring-teal-300' },
  blue: { card: 'bg-blue-50', icon: 'bg-blue-500', val: 'text-blue-700', ring: 'hover:ring-blue-300' },
  green: { card: 'bg-emerald-50', icon: 'bg-emerald-500', val: 'text-emerald-700', ring: 'hover:ring-emerald-300' },
  violet: { card: 'bg-violet-50', icon: 'bg-violet-500', val: 'text-violet-700', ring: 'hover:ring-violet-300' },
  amber: { card: 'bg-amber-50', icon: 'bg-amber-500', val: 'text-amber-700', ring: 'hover:ring-amber-300' },
  red: { card: 'bg-rose-50', icon: 'bg-rose-500', val: 'text-rose-700', ring: 'hover:ring-rose-300' },
};

function Stat({ icon: Icon, label, value, sub, tone, onClick }: any) {
  const t = TONES[tone] || TONES.primary;
  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-2xl p-4 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-2',
        t.card, t.ring,
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', t.icon)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-600">{label}</div>
          <div className={cn('truncate text-2xl font-bold leading-tight', t.val)}>{value}</div>
          {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
        </div>
        <ChevronRight className="ml-auto h-5 w-5 shrink-0 -translate-x-1 text-slate-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </div>
  );
}

function Spark({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const W = 320, H = 56, n = data.length || 1, bw = W / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full">
      {data.map((d, i) => {
        const h = (d.amount / max) * (H - 6);
        return <rect key={i} x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx={1.5} className="fill-primary/70 transition-colors hover:fill-primary">
          <title>{d.date}: {taka(d.amount)}</title>
        </rect>;
      })}
    </svg>
  );
}

// Focused "watch how to use the system" card. Users understand this is THE walkthrough
// video. Dismissible (remembered), but always available again from the side menu.
function TutorialBanner() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => localStorage.getItem('dk_tut_dismissed') === '1');
  if (hidden) return null;
  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('dk_tut_dismissed', '1');
    setHidden(true);
  };
  return (
    <div
      onClick={() => navigate('/tutorial')}
      className="group relative mb-6 flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-4 text-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md"
    >
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/30">
        <img src={ytThumb(OVERVIEW_VIDEO_ID)} alt="" className="h-full w-full object-cover" loading="lazy" />
        <PlayCircle className="absolute inset-0 m-auto h-8 w-8 drop-shadow" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-white/80">টিউটোরিয়াল ভিডিও</div>
        <div className="truncate text-lg font-bold">এই ভিডিওটি দেখলেই বুঝবেন কীভাবে ব্যবহার করবেন</div>
        <div className="truncate text-sm text-white/85">শুরু থেকে শেষ — পুরো সিস্টেমের সহজ পরিচিতি (মাত্র কয়েক মিনিট)</div>
      </div>
      <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold transition-colors group-hover:bg-white/25 sm:inline-flex">
        দেখুন <ChevronRight className="h-4 w-4" />
      </span>
      <button onClick={dismiss} aria-label="বন্ধ করুন" className="absolute right-2 top-2 rounded-full p-1 text-white/70 hover:bg-white/20 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isError } = useDashboard();

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm">
        {isError
          ? <span className="text-danger">Backend unreachable — is the server running?</span>
          : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected</span>}
      </p>

      <TutorialBanner />

      {/* WhatsApp community — support, short tutorials & all instructions */}
      <a
        href={COMMUNITY_URL}
        target="_blank"
        rel="noreferrer"
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 transition-all hover:border-emerald-300 hover:shadow-md"
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm">
          <MessageCircle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-emerald-900">আমাদের WhatsApp কমিউনিটিতে যোগ দিন</div>
          <div className="truncate text-sm text-emerald-700">সাপোর্ট, শর্ট টিউটোরিয়াল ও সব নির্দেশনা — এক জায়গায়</div>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white transition-opacity group-hover:opacity-90 sm:inline-flex">
          যোগ দিন <ChevronRight className="h-4 w-4" />
        </span>
      </a>

      {/* KPI grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Users} tone="primary" label="Total Patients" value={data?.patients ?? '—'} sub={`${data?.newPatientsMonth ?? 0} new this month`} onClick={() => navigate('/patients')} />
        <Stat icon={CalendarDays} tone="blue" label="Today's Appointments" value={data?.todayAppointments ?? '—'} sub={`${data?.weekAppointments ?? 0} this week`} onClick={() => navigate('/appointments')} />
        <Stat icon={Wallet} tone="green" label="Revenue Today" value={data ? taka(data.revenueToday) : '—'} sub={`${data?.paymentsToday ?? 0} payments collected`} onClick={() => navigate('/reports')} />
        <Stat icon={CalendarRange} tone="violet" label="Revenue This Month" value={data ? taka(data.revenueMonth) : '—'} sub={`${data ? taka(data.revenueTotal) : '—'} all-time`} onClick={() => navigate('/reports')} />
        <Stat icon={Stethoscope} tone="amber" label="Pending Treatments" value={data?.pendingTreatments ?? '—'} sub={`${data?.completedTreatments ?? 0} completed`} onClick={() => navigate('/patients')} />
        <Stat icon={AlertCircle} tone="red" label="Outstanding Dues" value={data ? taka(data.outstanding) : '—'} sub={`${data?.topDues?.length ?? 0} patients owe`} onClick={() => navigate('/reports')} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Today's schedule */}
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Today's schedule</CardTitle>
            <button className="text-sm font-medium text-primary hover:underline" onClick={() => navigate('/appointments')}>View all →</button>
          </CardHeader>
          <CardContent>
            {(!data?.todaySchedule || data.todaySchedule.length === 0)
              ? <p className="py-6 text-center text-sm text-muted-foreground">No appointments today.</p>
              : (
                <div className="space-y-1">
                  {data.todaySchedule.map((a: any) => (
                    <div key={a.id} className="group flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-primary/20 hover:bg-primary/5" onClick={() => a.patientId && navigate(`/patients/${a.patientId}`)}>
                      <div className="w-16 shrink-0 text-sm font-semibold tabular-nums text-primary">{fmtTime(a.time)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.patient || 'Unknown'} <span className="font-mono text-xs text-muted-foreground">{a.code}</span></div>
                        {a.reason && <div className="truncate text-xs text-muted-foreground">{a.reason}{a.chair ? ` · ${a.chair}` : ''}</div>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>

        {/* Revenue spark + top dues */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Revenue · last 14 days</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-2 text-2xl font-bold text-emerald-700">{data ? taka((data.spark ?? []).reduce((s: number, d: any) => s + d.amount, 0)) : '—'} <span className="text-sm font-normal text-muted-foreground">last 14 days</span></div>
              {data?.spark && <Spark data={data.spark} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Top outstanding dues</CardTitle></CardHeader>
            <CardContent>
              {(!data?.topDues || data.topDues.length === 0)
                ? <p className="text-sm text-muted-foreground">No dues 🎉</p>
                : (
                  <div className="space-y-1">
                    {data.topDues.map((d: any) => (
                      <div key={d.patientId} className="group flex cursor-pointer items-center justify-between rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-rose-200 hover:bg-rose-50" onClick={() => navigate(`/patients/${d.patientId}`)}>
                        <span className="truncate text-sm">{d.patient}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-1 text-sm font-semibold text-rose-600">{taka(d.balance)}<ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" /></span>
                      </div>
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
