import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  useAppointments, useAppointmentsRange, useApptMutations, useAvailability, useAvailabilityRange, taka, type Appointment,
} from '@/lib/clinical';
import { usePatients } from '@/lib/patients';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const STATUSES = ['BOOKED', 'CONFIRMED', 'ARRIVED', 'IN_CHAIR', 'COMPLETED', 'NO_SHOW', 'CANCELLED'];
const STATUS_COLOR: Record<string, string> = {
  BOOKED: 'bg-slate-200 text-slate-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  ARRIVED: 'bg-amber-100 text-amber-700',
  IN_CHAIR: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  NO_SHOW: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500 line-through',
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const hm = (s: string) => new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
// "14:30" -> "2:30 PM"
function to12h(t: string) {
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${p}`;
}
function addMinutes(t: string, mins: number) {
  const [h, m] = t.split(':').map(Number);
  const tot = h * 60 + m + mins;
  return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return iso(d);
}
function weekStart(dateStr: string) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - d.getDay()); // Sunday start
  return iso(d);
}
// First cell of the month grid = the Sunday on/before the 1st of the month.
function monthGridStart(dateStr: string) {
  const d = new Date(dateStr);
  d.setDate(1);
  d.setDate(d.getDate() - d.getDay());
  return iso(d);
}
// Attendance bucket: green = came, red = no-show/cancelled, grey = upcoming/unmarked.
function attendance(status: string): 'came' | 'noshow' | 'upcoming' {
  if (['COMPLETED', 'ARRIVED', 'IN_CHAIR'].includes(status)) return 'came';
  if (['NO_SHOW', 'CANCELLED'].includes(status)) return 'noshow';
  return 'upcoming';
}
const ATT_COLOR: Record<string, string> = {
  came: 'bg-green-100 text-green-800 border-green-300',
  noshow: 'bg-red-100 text-red-700 border-red-300 line-through',
  upcoming: 'bg-slate-200 text-slate-600 border-slate-300',
};

export function Appointments() {
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [anchor, setAnchor] = useState(today());
  const navigate = useNavigate();
  const m = useApptMutations();

  const wkStart = weekStart(anchor);
  const wkEnd = addDays(wkStart, 6);
  const day = useAppointments(anchor);
  const week = useAppointmentsRange(wkStart, wkEnd, view === 'week');
  const moGridStart = monthGridStart(anchor);
  const moGridEnd = addDays(moGridStart, 41); // 6 weeks
  const month = useAppointmentsRange(moGridStart, moGridEnd, view === 'month');

  const { data: dentists = [] } = useQuery<any[]>({ queryKey: ['dentists'], queryFn: async () => (await api.get('/appointments/dentists')).data });
  const { can } = useAuth();
  const [psearch, setPsearch] = useState('');
  const { data: pdata } = usePatients(psearch);
  // Inline new-patient quick-add (so receptionist needn't leave the booking screen).
  const [quick, setQuick] = useState<{ name: string; phone: string } | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const createPatientInline = async () => {
    if (!quick?.name.trim()) return;
    setQuickBusy(true);
    try {
      const { data } = await api.post('/patients', { fullName: quick.name, phone: quick.phone || undefined });
      setForm((f) => ({ ...f, patientId: data.id, patientName: data.fullName }));
      setQuick(null); setPsearch('');
    } finally {
      setQuickBusy(false);
    }
  };
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    patientId: params.get('patientId') || '',
    patientName: params.get('patientName') || '',
    date: anchor, dentistId: '', chair: 'Chair 1', start: '10:00', end: '10:30', duration: '30', reason: '',
  });
  const [error, setError] = useState('');
  // Live free/busy slots for the chosen date + chair + dentist.
  const avail = useAvailability(form.date, form.chair, form.dentistId || undefined, Number(form.duration), !!form.date);
  // Next 14 days free-slot counts for the "which date has openings" strip.
  const range = useAvailabilityRange(today(), 14, form.chair, form.dentistId || undefined, Number(form.duration));

  // Keep the selected slot valid: if it's taken (or none free chosen), jump to the first FREE slot.
  useEffect(() => {
    const slots = avail.data?.slots;
    if (!slots) return;
    const cur = slots.find((s) => s.start === form.start);
    if (!cur || !cur.available) {
      const firstFree = slots.find((s) => s.available);
      if (firstFree) setForm((f) => ({ ...f, start: firstFree.start, end: addMinutes(firstFree.start, Number(f.duration)) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avail.data]);

  const book = () => {
    if (!form.patientId) return;
    setError('');
    m.create.mutate({
      patientId: form.patientId,
      dentistId: form.dentistId || undefined,
      chair: form.chair,
      startTime: new Date(`${form.date}T${form.start}:00`).toISOString(),
      endTime: new Date(`${form.date}T${form.end}:00`).toISOString(),
      reason: form.reason || undefined,
    }, {
      onSuccess: () => { setForm({ ...form, patientId: '', patientName: '', reason: '' }); setPsearch(''); },
      onError: (e: any) => setError(e?.response?.data?.message || 'Could not book — time may be taken'),
    });
  };

  const nav = (dir: number) => {
    if (view === 'month') { const d = new Date(anchor); d.setMonth(d.getMonth() + dir); setAnchor(iso(d)); }
    else setAnchor(addDays(anchor, view === 'week' ? dir * 7 : dir));
  };

  const ApptRow = ({ a }: { a: Appointment }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border p-3">
      <div className="w-20 shrink-0 text-sm font-medium tabular-nums">{hm(a.startTime)}</div>
      <div className="min-w-0 flex-1 basis-40">
        <button className="font-medium hover:underline" onClick={() => navigate(`/patients/${a.patientId}`)}>{a.patient?.fullName}</button>
        <div className="truncate text-xs text-muted-foreground">
          {a.patient?.phone || 'no phone'} · {a.chair}{a.dentist ? ` · ${a.dentist.fullName}` : ''}{a.reason ? ` · ${a.reason}` : ''}
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {/* Outstanding due → click goes straight to this patient's billing */}
        {(a.due ?? 0) > 0 ? (
          <button
            onClick={() => navigate(`/patients/${a.patientId}?tab=${encodeURIComponent('Treatment & Billing')}`)}
            className="rounded-full bg-danger/10 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/20"
            title="Outstanding due — open billing"
          >
            Due {taka(a.due || 0)}
          </button>
        ) : (
          <button
            onClick={() => navigate(`/patients/${a.patientId}?tab=${encodeURIComponent('Treatment & Billing')}`)}
            className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70"
            title="Open billing"
          >
            Billing
          </button>
        )}
        <Select className={`h-8 w-28 text-xs ${STATUS_COLOR[a.status] || ''}`} value={a.status} onChange={(e) => m.update.mutate({ id: a.id, status: e.target.value })}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <button onClick={() => m.remove.mutate(a.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Appointments</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button onClick={() => setView('day')} className={`px-3 py-1 text-sm ${view === 'day' ? 'bg-primary text-primary-foreground' : ''}`}>Day</button>
            <button onClick={() => setView('week')} className={`px-3 py-1 text-sm ${view === 'week' ? 'bg-primary text-primary-foreground' : ''}`}>Week</button>
            <button onClick={() => setView('month')} className={`px-3 py-1 text-sm ${view === 'month' ? 'bg-primary text-primary-foreground' : ''}`}>Month</button>
          </div>
          <Button size="sm" variant="outline" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today())}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" className="w-40" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Booking */}
        <Card className="lg:col-span-1 self-start">
          <CardHeader><CardTitle>Book appointment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Patient</Label>
              {form.patientId ? (
                <div className="flex items-center justify-between rounded border border-border px-2 py-1.5 text-sm">
                  <span>{form.patientName}</span>
                  <button className="text-xs text-muted-foreground" onClick={() => setForm({ ...form, patientId: '', patientName: '' })}>change</button>
                </div>
              ) : quick ? (
                /* Inline new-patient form — no need to leave the booking screen */
                <div className="space-y-2 rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
                  <Input placeholder="Full name *" value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} autoFocus />
                  <Input placeholder="Phone" value={quick.phone} onChange={(e) => setQuick({ ...quick, phone: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!quick.name.trim() || quickBusy} onClick={createPatientInline}>Create &amp; select</Button>
                    <Button size="sm" variant="ghost" onClick={() => setQuick(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <Input placeholder="Search patient…" value={psearch} onChange={(e) => setPsearch(e.target.value)} />
                  {psearch && (
                    <div className="mt-1 max-h-40 overflow-auto rounded border border-border">
                      {(pdata?.items ?? []).map((p) => (
                        <button key={p.id} className="block w-full px-2 py-1 text-left text-sm hover:bg-muted"
                          onClick={() => { setForm({ ...form, patientId: p.id, patientName: p.fullName }); setPsearch(''); }}>
                          {p.fullName} <span className="text-xs text-muted-foreground">{p.code} · {p.phone || 'no phone'}</span>
                        </button>
                      ))}
                      {(pdata?.items ?? []).length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No match.</div>}
                    </div>
                  )}
                  {can('patients.manage') && (
                    <button className="mt-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => setQuick({ name: psearch, phone: '' })}>
                      + New patient
                    </button>
                  )}
                </>
              )}
            </div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>

            {/* Next-14-days openings at a glance — click a day to load its slots */}
            <div>
              <Label>Openings (next 14 days · {form.duration === '60' ? '1 hour' : '30 min'} slots)</Label>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {(range.data ?? []).map((d) => {
                  const sel = d.date === form.date;
                  const full = d.free === 0;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setForm({ ...form, date: d.date })}
                      className={cn(
                        'flex min-w-[58px] shrink-0 flex-col items-center rounded-md border px-1 py-1 text-center',
                        sel ? 'border-primary bg-primary text-primary-foreground'
                          : full ? 'border-danger/20 bg-danger/5'
                          : 'border-border bg-white hover:bg-muted',
                      )}
                    >
                      <span className="text-[10px]">{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                      <span className="text-sm font-bold leading-none">{new Date(d.date).getDate()}</span>
                      <span className={cn('text-[10px]', sel ? '' : full ? 'text-danger' : 'text-success')}>
                        {full ? 'Full' : `${d.free} free`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div><Label>Dentist</Label>
              <Select value={form.dentistId} onChange={(e) => setForm({ ...form, dentistId: e.target.value })}>
                <option value="">Unassigned</option>
                {dentists.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="min-w-0"><Label>Chair</Label><Select value={form.chair} onChange={(e) => setForm({ ...form, chair: e.target.value })}><option>Chair 1</option><option>Chair 2</option></Select></div>
              <div className="min-w-0"><Label>Start</Label><Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: addMinutes(e.target.value, Number(form.duration)) })} /></div>
              <div className="min-w-0">
                <Label>Duration</Label>
                <Select value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value, end: addMinutes(form.start, Number(e.target.value)) })}>
                  <option value="30">30 min</option>
                  <option value="60">1 hour</option>
                </Select>
              </div>
            </div>
            {/* Live availability — green = free, red = taken (hover to see by whom) */}
            <div>
              <Label>Free slots ({form.chair}{form.dentistId ? ' + selected dentist' : ''})</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(avail.data?.slots ?? []).map((s) => (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!s.available}
                    title={s.available ? 'Free' : `Taken by ${s.by || ''} (${s.reason})`}
                    onClick={() => setForm({ ...form, start: s.start, end: addMinutes(s.start, Number(form.duration)) })}
                    className={cn(
                      'rounded-md border px-2 py-2 text-center text-sm font-medium transition',
                      form.start === s.start
                        ? 'border-primary bg-primary text-primary-foreground'
                        : s.available
                          ? 'border-border bg-white hover:bg-muted'
                          : 'cursor-not-allowed border-danger/20 bg-danger/10 text-danger/60 line-through',
                    )}
                  >
                    {to12h(s.start)}–{to12h(s.end)}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            {error && <p className="rounded bg-danger/10 p-2 text-sm text-danger">{error}</p>}
            <Button className="w-full" onClick={book} disabled={!form.patientId || m.create.isPending}>
              Book {to12h(form.start)}–{to12h(form.end)}
            </Button>
          </CardContent>
        </Card>

        {/* Schedule */}
        <div className="lg:col-span-2">
          {view === 'month' ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>{new Date(anchor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</CardTitle>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-green-300 bg-green-100" /> Came</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-red-300 bg-red-100" /> No-show</span>
                  <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-200" /> Upcoming</span>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="grid min-w-[680px] grid-cols-7 gap-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div key={d} className="pb-1 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                  ))}
                  {Array.from({ length: 42 }, (_, i) => addDays(moGridStart, i)).map((d) => {
                    const list = (month.data ?? []).filter((a) => iso(new Date(a.startTime)) === d);
                    const inMonth = new Date(d + 'T00:00:00').getMonth() === new Date(anchor + 'T00:00:00').getMonth();
                    const isToday = d === today();
                    return (
                      <div key={d} className={cn('min-h-[96px] rounded border border-border p-1', inMonth ? 'bg-white' : 'bg-muted/30 opacity-60')}>
                        <button onClick={() => { setAnchor(d); setView('day'); }}
                          className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>
                          {new Date(d + 'T00:00:00').getDate()}
                        </button>
                        <div className="space-y-0.5">
                          {list.slice(0, 4).map((a) => (
                            <button key={a.id} title={`${hm(a.startTime)} ${a.patient?.fullName} · ${a.status}`}
                              onClick={() => { setAnchor(d); setView('day'); }}
                              className={cn('block w-full truncate rounded border px-1 py-0.5 text-left text-[11px]', ATT_COLOR[attendance(a.status)])}>
                              {hm(a.startTime)} {a.patient?.fullName}
                            </button>
                          ))}
                          {list.length > 4 && <div className="px-1 text-[10px] text-muted-foreground">+{list.length - 4} more</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : view === 'day' ? (
            <Card>
              <CardHeader><CardTitle>{new Date(anchor).toDateString()} — {(day.data ?? []).length} appointment(s)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(day.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No appointments. Pick a patient and book one →</p>}
                {(day.data ?? []).map((a) => <ApptRow key={a.id} a={a} />)}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Week of {new Date(wkStart).toDateString()}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <div className="grid min-w-[640px] grid-cols-7 gap-1 text-xs">
                  {Array.from({ length: 7 }, (_, i) => addDays(wkStart, i)).map((d) => {
                    const list = (week.data ?? []).filter((a) => iso(new Date(a.startTime)) === d);
                    const isToday = d === today();
                    return (
                      <div key={d} className="min-h-[120px] rounded border border-border p-1">
                        <button
                          onClick={() => { setAnchor(d); setView('day'); }}
                          className={`mb-1 w-full rounded px-1 text-center font-semibold ${isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                          {new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' })}
                        </button>
                        {list.map((a) => (
                          <button key={a.id} onClick={() => { setAnchor(d); setView('day'); }}
                            className={`mb-0.5 block w-full truncate rounded px-1 py-0.5 text-left ${STATUS_COLOR[a.status] || 'bg-muted'}`}>
                            {hm(a.startTime)} {a.patient?.fullName}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
