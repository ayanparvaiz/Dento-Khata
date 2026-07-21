import { useEffect, useState, useCallback } from 'react';
import { superApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, LogOut } from 'lucide-react';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  ownerName?: string;
  phone?: string;
  isActive: boolean;
  users: number;
  patients: number;
  pendingPayment?: boolean;
  lastPaymentStatus?: string | null;
  lastPaymentAmount?: number | null;
  subscription: { status: string; active: boolean; currentPeriodEnd: string | null; daysLeft: number | null; amount: number } | null;
}
interface Pending {
  id: string;
  amount: number;
  method: string;
  trxId?: string;
  senderMsisdn?: string;
  submittedAt: string;
  tenant?: { id: string; name: string; slug: string } | null;
}
interface TUser {
  id: string;
  phone: string;
  username?: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface Analytics {
  totals: { tenants: number; active: number; pending: number; suspended: number };
  mrr: number; revenueTotal: number; revenueThisMonth: number;
  signups: { date: string; count: number }[];
  spam: { neverActivated: number; duplicateIps: { ip: string; count: number }[]; lastHour: number };
  topClinics: { name: string; slug: string; patients: number }[];
  recentSignups: { name: string; slug: string; phone?: string; signupIp?: string; isActive: boolean; createdAt: string; status: string }[];
  traffic: Traffic;
}

interface Traffic {
  total: number; real: number; bounces: number;
  avgTimeSec: number; avgScroll: number;
  signups: number; conversionRate: number; fromAds: number;
  device: { mobile: number; desktop: number };
  scrollBuckets: { label: string; count: number }[];
  timeBuckets: { label: string; count: number }[];
  visitsByDay: { date: string; count: number }[];
}

function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString();
}

export function SuperAdmin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('superToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [an, setAn] = useState<Analytics | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [grantDays, setGrantDays] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Users panel (support-desk credential reset)
  const [usersFor, setUsersFor] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<TUser[]>([]);
  const [reset, setReset] = useState<Record<string, { phone: string; password: string }>>({});

  const openUsers = async (t: Tenant) => {
    setUsersFor(t);
    setUsers([]);
    setReset({});
    try {
      const { data } = await superApi.get(`/superadmin/tenants/${t.id}/users`);
      setUsers(data);
    } catch {
      /* ignore */
    }
  };
  const doReset = async (userId: string) => {
    const r = reset[userId] || { phone: '', password: '' };
    const body: any = {};
    if (r.phone.trim()) body.phone = r.phone.trim();
    if (r.password.trim()) body.password = r.password.trim();
    if (!Object.keys(body).length) return alert('নতুন ফোন বা পাসওয়ার্ড দিন');
    try {
      await superApi.post(`/superadmin/users/${userId}/reset`, body);
      alert('আপডেট হয়েছে');
      if (usersFor) openUsers(usersFor);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'ব্যর্থ হয়েছে');
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t, p] = await Promise.all([
        superApi.get('/superadmin/analytics'),
        superApi.get('/superadmin/tenants'),
        superApi.get('/superadmin/payments/pending'),
      ]);
      setAn(a.data);
      setTenants(t.data);
      setPending(p.data);
    } catch (e: any) {
      if (e?.response?.status === 403 || e?.response?.status === 401) {
        localStorage.removeItem('superToken');
        setAuthed(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await superApi.post('/superadmin/login', { username, password });
      localStorage.setItem('superToken', data.access_token);
      setAuthed(true);
    } catch {
      setError('Invalid credentials');
    }
  };

  const logout = () => {
    localStorage.removeItem('superToken');
    setAuthed(false);
  };

  const act = async (fn: () => Promise<any>) => {
    try {
      await fn();
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Action failed');
    }
  };

  if (!authed) {
    return (
      <div className="grid h-screen place-items-center bg-slate-900 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-8">
            <div className="mb-6 flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-bold">Platform Admin</h1>
              <p className="text-sm text-muted-foreground">Super-admin console</p>
            </div>
            <form onSubmit={login} className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full">Sign in</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-slate-700" />
            <h1 className="text-2xl font-bold">Platform Admin</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-sm text-primary hover:underline">Refresh</button>
            <button onClick={logout} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </header>

        {an && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              <Kpi label="Clinics" value={an.totals.tenants} />
              <Kpi label="Active" value={an.totals.active} tone="text-emerald-600" />
              <Kpi label="Pending" value={an.totals.pending} tone="text-amber-600" />
              <Kpi label="Suspended" value={an.totals.suspended} tone="text-red-600" />
              <Kpi label="MRR" value={`৳${an.mrr}`} />
              <Kpi label="Revenue (mo)" value={`৳${an.revenueThisMonth}`} sub={`৳${an.revenueTotal} total`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Signups sparkbars */}
              <Card className="lg:col-span-2">
                <CardContent className="pt-5">
                  <p className="mb-3 text-sm font-semibold">Signups — last 14 days</p>
                  <div className="flex h-24 items-end gap-1">
                    {an.signups.map((d) => {
                      const max = Math.max(1, ...an.signups.map((x) => x.count));
                      return (
                        <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                          <div className="w-full rounded-t bg-primary/80" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 3 : 0 }} />
                          <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Abuse / spam signals */}
              <Card className={an.spam.neverActivated || an.spam.duplicateIps.length || an.spam.lastHour > 3 ? 'border-amber-300' : ''}>
                <CardContent className="space-y-2 pt-5 text-sm">
                  <p className="font-semibold">Abuse signals</p>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Signups last hour</span><span className={an.spam.lastHour > 3 ? 'font-bold text-amber-600' : 'font-semibold'}>{an.spam.lastHour}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Never activated (48h+)</span><span className={an.spam.neverActivated > 0 ? 'font-bold text-amber-600' : 'font-semibold'}>{an.spam.neverActivated}</span></div>
                  <div>
                    <span className="text-muted-foreground">Repeated signup IPs</span>
                    {an.spam.duplicateIps.length === 0 ? <span className="ml-2 font-semibold">none</span> : (
                      <div className="mt-1 space-y-0.5">
                        {an.spam.duplicateIps.slice(0, 4).map((d) => (
                          <div key={d.ip} className="flex justify-between rounded bg-amber-50 px-2 py-0.5 text-xs"><span className="font-mono">{d.ip}</span><span className="font-bold text-amber-700">×{d.count}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Top clinics */}
              {an.topClinics.length > 0 && (
                <Card>
                  <CardContent className="pt-5">
                    <p className="mb-2 text-sm font-semibold">Top clinics by patients</p>
                    <div className="flex flex-wrap gap-2">
                      {an.topClinics.map((c) => (
                        <span key={c.slug} className="rounded-full bg-slate-100 px-3 py-1 text-xs"><b>{c.name}</b> · {c.patients} patients</span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent signups (with IP, for spam monitoring) */}
              <Card>
                <CardContent className="pt-5">
                  <p className="mb-2 text-sm font-semibold">Recent signups</p>
                  <div className="max-h-56 space-y-1 overflow-auto text-xs">
                    {an.recentSignups.map((r) => (
                      <div key={r.slug} className="flex items-center justify-between gap-2 rounded border-b border-slate-100 py-1">
                        <span className="truncate"><b>{r.name}</b> <span className="text-muted-foreground">· {r.phone || '—'}</span></span>
                        <span className="flex flex-none items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{r.signupIp || '—'}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : r.status === 'SUSPENDED' || !r.isActive ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{!r.isActive ? 'SUSPENDED' : r.status}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Landing-page engagement */}
            {an.traffic && <TrafficPanel t={an.traffic} />}
          </div>
        )}

        {/* Pending payments */}
        <section>
          <h2 className="mb-2 text-lg font-semibold">Pending payments {pending.length > 0 && <span className="text-amber-600">({pending.length})</span>}</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments awaiting verification.</p>
          ) : (
            <div className="space-y-2">
              {pending.map((p) => (
                <Card key={p.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="text-sm">
                      <p className="font-semibold">{p.tenant?.name || 'Unknown clinic'} <span className="font-normal text-muted-foreground">({p.tenant?.slug})</span></p>
                      <p className="text-muted-foreground">৳{p.amount} · TrxID <span className="font-mono">{p.trxId || '—'}</span> · from {p.senderMsisdn || '—'} · {fmtDate(p.submittedAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => act(() => superApi.post(`/superadmin/payments/${p.id}/verify`))}>Verify (+30d)</Button>
                      <Button size="sm" variant="outline" onClick={() => act(() => superApi.post(`/superadmin/payments/${p.id}/reject`))}>Reject</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Tenants */}
        <section>
          <h2 className="mb-2 text-lg font-semibold">Clinics</h2>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Clinic</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3">Users / Patients</th>
                  <th className="p-3">Grant days</th>
                  <th className="p-3">Account</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => {
                  const s = t.subscription;
                  // Distinct, non-ambiguous status: suspended > active > payment-in-review >
                  // last-rejected > plain pending. So the operator always knows the real state.
                  let label: string, badge: string;
                  if (!t.isActive) { label = 'SUSPENDED'; badge = 'bg-red-100 text-red-700'; }
                  else if (s?.active) { label = s.status; badge = 'bg-emerald-100 text-emerald-700'; }
                  else if (t.pendingPayment) { label = '⏳ PAYMENT REVIEW'; badge = 'bg-blue-100 text-blue-700'; }
                  else if (t.lastPaymentStatus === 'REJECTED') { label = '❌ REJECTED'; badge = 'bg-rose-100 text-rose-700'; }
                  else { label = s?.status || 'PENDING'; badge = 'bg-amber-100 text-amber-700'; }
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.ownerName} · {t.phone || '—'}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{t.slug}</td>
                      <td className="p-3">
                        <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="p-3">{fmtDate(s?.currentPeriodEnd ?? null)}{s?.daysLeft != null && s.active && <span className="ml-1 text-xs text-muted-foreground">({s.daysLeft}d)</span>}</td>
                      <td className="p-3">{t.users} / {t.patients}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8 w-16"
                            placeholder="7"
                            value={grantDays[t.id] || ''}
                            onChange={(e) => setGrantDays((g) => ({ ...g, [t.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const d = parseInt(grantDays[t.id] || '0', 10);
                              if (!d || d < 1) return alert('Enter a number of days');
                              act(() => superApi.post('/superadmin/grant', { tenantId: t.id, days: d }));
                            }}
                          >
                            Grant
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openUsers(t)}>Users</Button>
                          {t.isActive ? (
                            <Button size="sm" variant="outline" onClick={() => act(() => superApi.post(`/superadmin/tenants/${t.id}/suspend`))}>Suspend</Button>
                          ) : (
                            <Button size="sm" onClick={() => act(() => superApi.post(`/superadmin/tenants/${t.id}/activate`))}>Activate</Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => {
                              if (!confirm(`Permanently DELETE "${t.name}" and ALL its data (${t.users} users, ${t.patients} patients)? This cannot be undone.`)) return;
                              act(() => superApi.post(`/superadmin/tenants/${t.id}/delete`));
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
      </div>

      {/* Users / credential-reset modal */}
      {usersFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setUsersFor(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{usersFor.name} — Users</h3>
              <button onClick={() => setUsersFor(null)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">Support-desk: set a new login phone and/or password for any user of this clinic.</p>
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users.</p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => (
                  <div key={u.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium">{u.fullName}</span>{' '}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{u.role}</span>
                        {!u.isActive && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">inactive</span>}
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">{u.phone}</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">New phone</Label>
                        <Input
                          className="h-8"
                          placeholder={u.phone}
                          value={reset[u.id]?.phone || ''}
                          onChange={(e) => setReset((r) => ({ ...r, [u.id]: { ...(r[u.id] || { phone: '', password: '' }), phone: e.target.value } }))}
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">New password</Label>
                        <Input
                          className="h-8"
                          placeholder="••••••"
                          value={reset[u.id]?.password || ''}
                          onChange={(e) => setReset((r) => ({ ...r, [u.id]: { ...(r[u.id] || { phone: '', password: '' }), password: e.target.value } }))}
                        />
                      </div>
                      <Button size="sm" onClick={() => doReset(u.id)}>Reset</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Landing-page engagement: how long visitors stay and how far they read.
function TrafficPanel({ t }: { t: Traffic }) {
  const maxDay = Math.max(1, ...t.visitsByDay.map((d) => d.count));
  const barMax = (arr: { count: number }[]) => Math.max(1, ...arr.map((b) => b.count));
  const sMax = barMax(t.scrollBuckets);
  const tMax = barMax(t.timeBuckets);
  return (
    <Card className="border-teal-100">
      <CardContent className="space-y-4 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Landing page engagement <span className="font-normal text-muted-foreground">— last 30 days</span></p>
          <span className="text-xs text-muted-foreground">{t.real} real visits · {t.bounces} bounced</span>
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Kpi label="Visitors" value={t.total} sub={`${t.fromAds} from ads`} />
          <Kpi label="Avg. time on page" value={fmtDuration(t.avgTimeSec)} tone="text-teal-700" />
          <Kpi label="Avg. read (scroll)" value={`${t.avgScroll}%`} tone="text-teal-700" />
          <Kpi label="Signups" value={t.signups} tone="text-emerald-600" />
          <Kpi label="Conversion" value={`${t.conversionRate}%`} tone="text-emerald-600" sub="visit → signup" />
          <Kpi label="Mobile / Desktop" value={`${t.device.mobile} / ${t.device.desktop}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* How far they read */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">কতদূর পড়ছে (scroll depth)</p>
            <div className="space-y-1.5">
              {t.scrollBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 flex-none text-muted-foreground">{b.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded bg-teal-500" style={{ width: `${(b.count / sMax) * 100}%` }} />
                  </div>
                  <span className="w-6 flex-none text-right font-semibold">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How long they stay */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">কতক্ষণ থাকছে (time on page)</p>
            <div className="space-y-1.5">
              {t.timeBuckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 flex-none text-muted-foreground">{b.label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded bg-indigo-500" style={{ width: `${(b.count / tMax) * 100}%` }} />
                  </div>
                  <span className="w-6 flex-none text-right font-semibold">{b.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Visits per day */}
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">ভিজিট — ১৪ দিন</p>
            <div className="flex h-24 items-end gap-1">
              {t.visitsByDay.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                  <div className="w-full rounded-t bg-teal-400" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: d.count ? 3 : 0 }} />
                  <span className="text-[8px] text-muted-foreground">{d.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Small KPI stat tile.
function Kpi({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${tone || ''}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
