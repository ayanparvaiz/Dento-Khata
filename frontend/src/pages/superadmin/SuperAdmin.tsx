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

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString();
}

export function SuperAdmin() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('superToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [metrics, setMetrics] = useState<{ tenants: number; activeTenants: number; mrr: number } | null>(null);
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
      const [m, t, p] = await Promise.all([
        superApi.get('/superadmin/metrics'),
        superApi.get('/superadmin/tenants'),
        superApi.get('/superadmin/payments/pending'),
      ]);
      setMetrics(m.data);
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

        {metrics && (
          <div className="grid grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Clinics</p><p className="text-3xl font-bold">{metrics.tenants}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-3xl font-bold text-emerald-600">{metrics.activeTenants}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">MRR</p><p className="text-3xl font-bold">৳{metrics.mrr}</p></CardContent></Card>
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
                  const badge = !t.isActive
                    ? 'bg-red-100 text-red-700'
                    : s?.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700';
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="p-3">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.ownerName} · {t.phone || '—'}</p>
                      </td>
                      <td className="p-3 font-mono text-xs">{t.slug}</td>
                      <td className="p-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}>
                          {!t.isActive ? 'SUSPENDED' : s?.status || 'NONE'}
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
