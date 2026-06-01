import { useNavigate } from 'react-router-dom';
import { useDashboard, taka } from '@/lib/clinical';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CalendarDays, CalendarRange, Stethoscope, Wallet, AlertCircle } from 'lucide-react';

const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const STATUS_TONE: Record<string, string> = {
  SCHEDULED: 'bg-blue-500/10 text-blue-600',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600',
  CANCELLED: 'bg-rose-500/10 text-rose-600',
  NO_SHOW: 'bg-amber-500/10 text-amber-600',
};

function Stat({ icon: Icon, label, value, sub, tone, onClick }: any) {
  const tones: Record<string, string> = {
    primary: 'bg-primary/10 text-primary', green: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600', amber: 'bg-amber-500/10 text-amber-600',
    red: 'bg-rose-500/10 text-rose-600', violet: 'bg-violet-500/10 text-violet-600',
  };
  return (
    <Card className="cursor-pointer transition hover:shadow-md" onClick={onClick}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-muted-foreground">{label}</div>
          <div className="truncate text-2xl font-bold leading-tight">{value}</div>
          {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Spark({ data }: { data: { date: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const W = 320, H = 56, n = data.length || 1, bw = W / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full">
      {data.map((d, i) => {
        const h = (d.amount / max) * (H - 6);
        return <rect key={i} x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx={1.5} className="fill-primary/70">
          <title>{d.date}: {taka(d.amount)}</title>
        </rect>;
      })}
    </svg>
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
          ? <span className="text-danger">Backend unreachable — is the server PC running?</span>
          : <span className="text-success">Connected ✓ · offline LAN</span>}
      </p>

      {/* KPI grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={Users} tone="primary" label="Total Patients" value={data?.patients ?? '—'} sub={`${data?.newPatientsMonth ?? 0} new this month`} onClick={() => navigate('/patients')} />
        <Stat icon={CalendarDays} tone="blue" label="Today's Appointments" value={data?.todayAppointments ?? '—'} sub={`${data?.weekAppointments ?? 0} this week`} onClick={() => navigate('/appointments')} />
        <Stat icon={Wallet} tone="green" label="Revenue Today" value={data ? taka(data.revenueToday) : '—'} sub={`${data?.paymentsToday ?? 0} payments collected`} onClick={() => navigate('/reports')} />
        <Stat icon={CalendarRange} tone="violet" label="Revenue This Month" value={data ? taka(data.revenueMonth) : '—'} sub={`${data ? taka(data.revenueTotal) : '—'} all-time`} onClick={() => navigate('/reports')} />
        <Stat icon={Stethoscope} tone="amber" label="Pending Treatments" value={data?.pendingTreatments ?? '—'} sub={`${data?.completedTreatments ?? 0} completed`} onClick={() => navigate('/patients')} />
        <Stat icon={AlertCircle} tone="red" label="Outstanding Dues" value={data ? taka(data.outstanding) : '—'} sub={`${data?.topDues?.length ?? 0} patients owe`} onClick={() => navigate('/reports')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's schedule */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Today's schedule</CardTitle>
            <button className="text-sm text-primary hover:underline" onClick={() => navigate('/appointments')}>View all →</button>
          </CardHeader>
          <CardContent>
            {(!data?.todaySchedule || data.todaySchedule.length === 0)
              ? <p className="py-6 text-center text-sm text-muted-foreground">No appointments today.</p>
              : (
                <div className="space-y-1">
                  {data.todaySchedule.map((a: any) => (
                    <div key={a.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted" onClick={() => a.patientId && navigate(`/patients/${a.patientId}`)}>
                      <div className="w-16 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.time)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{a.patient || 'Unknown'} <span className="font-mono text-xs text-muted-foreground">{a.code}</span></div>
                        {a.reason && <div className="truncate text-xs text-muted-foreground">{a.reason}{a.chair ? ` · ${a.chair}` : ''}</div>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[a.status] || 'bg-muted text-muted-foreground'}`}>{a.status}</span>
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
              <div className="mb-2 text-2xl font-bold">{data ? taka(data.revenueMonth) : '—'} <span className="text-sm font-normal text-muted-foreground">this month</span></div>
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
                      <div key={d.patientId} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted" onClick={() => navigate(`/patients/${d.patientId}`)}>
                        <span className="truncate text-sm">{d.patient}</span>
                        <span className="ml-2 shrink-0 text-sm font-semibold text-rose-600">{taka(d.balance)}</span>
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
