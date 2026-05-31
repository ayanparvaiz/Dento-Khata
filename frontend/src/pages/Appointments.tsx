import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  useAppointments, useAppointmentsRange, useApptMutations, useAvailability, useAvailabilityRange, taka, type Appointment,
} from '@/lib/clinical';
import { usePatients } from '@/lib/patients';
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

export function Appointments() {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [anchor, setAnchor] = useState(today());
  const navigate = useNavigate();
  const m = useApptMutations();

  const wkStart = weekStart(anchor);
  const wkEnd = addDays(wkStart, 6);
  const day = useAppointments(anchor);
  const week = useAppointmentsRange(wkStart, wkEnd, view === 'week');

  const { data: dentists = [] } = useQuery<any[]>({ queryKey: ['dentists'], queryFn: async () => (await api.get('/appointments/dentists')).data });
  const [psearch, setPsearch] = useState('');
  const { data: pdata } = usePatients(psearch);
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

  const nav = (dir: number) => setAnchor(addDays(anchor, view === 'week' ? dir * 7 : dir));

  const ApptRow = ({ a }: { a: Appointment }) => (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <div className="w-24 shrink-0 text-sm font-medium">{hm(a.startTime)}–{hm(a.endTime)}</div>
      <div className="min-w-0 flex-1">
        <button className="font-medium hover:underline" onClick={() => navigate(`/patients/${a.patientId}`)}>{a.patient?.fullName}</button>
        <div className="text-xs text-muted-foreground">
          {a.patient?.phone || 'no phone'} · {a.chair}{a.dentist ? ` · ${a.dentist.fullName}` : ''}{a.reason ? ` · ${a.reason}` : ''}
        </div>
      </div>
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
      <Select className={`h-8 w-32 text-xs ${STATUS_COLOR[a.status] || ''}`} value={a.status} onChange={(e) => m.update.mutate({ id: a.id, status: e.target.value })}>
        {STATUSES.map((s) => <option key={s}>{s}</option>)}
      </Select>
      <button onClick={() => m.remove.mutate(a.id)} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Appointments</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border">
            <button onClick={() => setView('day')} className={`px-3 py-1 text-sm ${view === 'day' ? 'bg-primary text-primary-foreground' : ''}`}>Day</button>
            <button onClick={() => setView('week')} className={`px-3 py-1 text-sm ${view === 'week' ? 'bg-primary text-primary-foreground' : ''}`}>Week</button>
          </div>
          <Button size="sm" variant="outline" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(today())}>Today</Button>
          <Button size="sm" variant="outline" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Input type="date" className="w-40" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
                    </div>
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
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Chair</Label><Select value={form.chair} onChange={(e) => setForm({ ...form, chair: e.target.value })}><option>Chair 1</option><option>Chair 2</option></Select></div>
              <div><Label>Start</Label><Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: addMinutes(e.target.value, Number(form.duration)) })} /></div>
              <div>
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
          {view === 'day' ? (
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
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-xs">
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
