import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePatient, type MedicalHistory } from '@/lib/patients';
import { useAuth } from '@/lib/auth';
import { ageFromDob, fmtDate, splitList } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DentalChart } from '@/components/DentalChart';
import { TreatmentBillingTab } from '@/components/TreatmentBillingTab';
import { NotesTab } from '@/components/NotesTab';
import { PrescriptionsTab } from '@/components/PrescriptionsTab';
import { ImagingTab } from '@/components/ImagingTab';
import { usePatientAppointments, useLedger, taka } from '@/lib/clinical';
import { useTreatment } from '@/lib/treatment';
import { AlertTriangle, ArrowLeft, CalendarPlus, Pencil } from 'lucide-react';

const TABS = [
  'Overview',
  'Medical History',
  'Dental Chart',
  'Prescriptions',
  'Treatment & Billing',
  'Notes',
  'Imaging',
  'Appointments',
] as const;
type Tab = (typeof TABS)[number];

// Capability needed to see/use each tab (null = always; viewing list/overview is open).
const TAB_CAP: Record<Tab, string[] | null> = {
  Overview: null,
  'Medical History': ['medical.manage'],
  'Dental Chart': ['charting.manage'],
  Prescriptions: ['prescriptions.manage'],
  'Treatment & Billing': ['treatment.manage', 'billing.manage'],
  Notes: ['notes.manage'],
  Imaging: ['imaging.manage'],
  Appointments: ['appointments.manage'],
};

const FUTURE: Partial<Record<Tab, string>> = {};

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || '—'}</div>
    </div>
  );
}

export function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: p, isLoading } = usePatient(id);
  const { can } = useAuth();
  const [params] = useSearchParams();
  const visibleTabs = TABS.filter((t) => TAB_CAP[t] === null || TAB_CAP[t]!.some((c) => can(c)));
  const wanted = (TABS.find((t) => t === params.get('tab')) ?? 'Overview') as Tab;
  const initialTab = visibleTabs.includes(wanted) ? wanted : 'Overview';
  const [tab, setTab] = useState<Tab>(initialTab);

  if (isLoading || !p) return <div className="p-6 text-muted-foreground">Loading…</div>;

  // Build the medical alert list (the red banner real dental software shows on every patient).
  const mh = p.medicalHistory;
  const allergies = splitList(mh?.allergies);
  const conditions = splitList(mh?.conditions);
  const alerts: { text: string; level: 'danger' | 'warning' }[] = [
    ...allergies.map((a) => ({ text: `Allergy: ${a}`, level: 'danger' as const })),
    ...conditions.map((c) => ({ text: c, level: 'warning' as const })),
    ...(mh?.premedRequired ? [{ text: 'Premedication required', level: 'warning' as const }] : []),
    ...(mh?.isPregnant ? [{ text: 'Pregnant', level: 'warning' as const }] : []),
  ];

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/patients')}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All patients
      </button>

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
            {p.fullName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{p.fullName}</h1>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono">{p.code}</span> · {p.gender || '—'} ·{' '}
              {ageFromDob(p.dateOfBirth)} · {p.phone || 'no phone'}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate(`/patients/${p.id}/edit`)}>
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </div>

      {/* Medical alert banner */}
      {alerts.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-danger/30 bg-danger/5 p-3">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <span className="text-sm font-semibold text-danger">Medical alerts:</span>
          {alerts.map((a, i) => (
            <span
              key={i}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                a.level === 'danger' ? 'bg-danger text-white' : 'bg-warning/15 text-warning',
              )}
            >
              {a.text}
            </span>
          ))}
        </div>
      )}

      {/* Tabs — pill segmented control: active = solid teal, inactive = clear dark text */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/60 p-1 lg:flex-wrap [&::-webkit-scrollbar]:hidden">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
              tab === t
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-600 hover:bg-white hover:text-foreground',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab patient={p} onTab={setTab} />}

      {tab === 'Medical History' && <MedicalHistoryTab patientId={p.id} initial={mh} />}

      {tab === 'Dental Chart' && <DentalChart patientId={p.id} />}

      {tab === 'Treatment & Billing' && <TreatmentBillingTab patient={p} />}

      {tab === 'Notes' && <NotesTab patientId={p.id} />}

      {tab === 'Prescriptions' && <PrescriptionsTab patient={p} />}

      {tab === 'Imaging' && <ImagingTab patientId={p.id} />}

      {tab === 'Appointments' && <PatientAppointments patientId={p.id} patientName={p.fullName} />}

      {FUTURE[tab] && (
        <Card>
          <CardHeader>
            <CardTitle>Coming in {FUTURE[tab]}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This patient’s {tab.toLowerCase()} will appear here once {FUTURE[tab]} is implemented.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MedicalHistoryTab({
  patientId,
  initial,
}: {
  patientId: string;
  initial?: MedicalHistory | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<MedicalHistory>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(initial ?? {}), [initial]);
  const set = (k: keyof MedicalHistory, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => (await api.put(`/patients/${patientId}/medical-history`, form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient', patientId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const text = (k: keyof MedicalHistory, label: string, ph?: string) => (
    <div>
      <Label>{label}</Label>
      <Input
        value={(form[k] as string) || ''}
        placeholder={ph}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  );

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Medical &amp; dental history</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {text('allergies', 'Allergies', 'e.g. Penicillin, Latex (comma separated)')}
          {text('conditions', 'Systemic conditions', 'e.g. Diabetes, Hypertension, Cardiac')}
          {text('medications', 'Current medications')}
          {text('habits', 'Habits', 'Smoking, tobacco/gutka, betel nut, alcohol')}
          {text('pastDentalHistory', 'Past dental history')}
          {text('notes', 'Notes')}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.premedRequired}
                onChange={(e) => set('premedRequired', e.target.checked)}
              />
              Premedication required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.isPregnant}
                onChange={(e) => set('isPregnant', e.target.checked)}
              />
              Pregnant
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save history'}
            </Button>
            {saved && <span className="text-sm text-success">Saved ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PatientAppointments({ patientId, patientName }: { patientId: string; patientName: string }) {
  const navigate = useNavigate();
  const { data: appts = [] } = usePatientAppointments(patientId);
  // Open the booking page with THIS patient already selected.
  const bookFor = () =>
    navigate(`/appointments?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`);
  const now = Date.now();
  const upcoming = appts.filter((a) => new Date(a.startTime).getTime() >= now);
  const past = appts.filter((a) => new Date(a.startTime).getTime() < now);

  const fmt = (s: string) =>
    new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const Row = ({ a }: { a: any }) => (
    <div className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
      <div>
        <div className="font-medium">{fmt(a.startTime)}</div>
        <div className="text-xs text-muted-foreground">
          {a.chair}{a.dentist ? ` · ${a.dentist.fullName}` : ''}{a.reason ? ` · ${a.reason}` : ''}
        </div>
      </div>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Upcoming ({upcoming.length})</CardTitle>
          <Button size="sm" onClick={bookFor}>
            <CalendarPlus className="h-4 w-4" /> Book appointment
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
          {upcoming.map((a) => <Row key={a.id} a={a} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>History ({past.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past appointments.</p>}
          {past.map((a) => <Row key={a.id} a={a} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: 'danger' | 'success'; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`rounded-lg border border-border bg-card p-3 text-left ${onClick ? 'hover:shadow-sm' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : ''}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );
}

function OverviewTab({ patient, onTab }: { patient: import('@/lib/patients').Patient; onTab: (t: any) => void }) {
  const id = patient.id;
  const { data: ledger } = useLedger(id);
  const { data: appts = [] } = usePatientAppointments(id);
  const { data: plans = [] } = useTreatment(id);
  const now = Date.now();
  const dtm = (s?: string | null) => (s ? new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const upcoming = appts.filter((a) => +new Date(a.startTime) >= now).sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime))[0];
  const lastVisit = appts.filter((a) => +new Date(a.startTime) < now).sort((a, b) => +new Date(b.startTime) - +new Date(a.startTime))[0];
  const pendingFee = plans.flatMap((p) => p.items).filter((i) => i.status === 'PLANNED').reduce((s, i) => s + i.fee, 0);
  const c: Record<string, number> = (patient as any)._count || {};
  const mh = patient.medicalHistory;

  return (
    <div className="space-y-6">
      {/* Snapshot tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Balance due" value={taka(ledger?.balance || 0)} tone={(ledger?.balance || 0) > 0 ? 'danger' : 'success'} onClick={() => onTab('Treatment & Billing')} />
        <Tile label="Next appointment" value={upcoming ? dtm(upcoming.startTime) : 'None'} sub={upcoming?.reason || ''} onClick={() => onTab('Appointments')} />
        <Tile label="Pending treatment" value={taka(pendingFee)} sub={`${plans.length} plan(s)`} onClick={() => onTab('Treatment & Billing')} />
        <Tile label="Last visit" value={lastVisit ? dtm(lastVisit.startTime) : '—'} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Prescriptions" value={String(c.prescriptions ?? 0)} onClick={() => onTab('Prescriptions')} />
        <Tile label="X-rays / images" value={String(c.files ?? 0)} onClick={() => onTab('Imaging')} />
        <Tile label="Teeth charted" value={String(c.toothRecords ?? 0)} onClick={() => onTab('Dental Chart')} />
        <Tile label="Invoices" value={String(c.invoices ?? 0)} onClick={() => onTab('Treatment & Billing')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Personal</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info label="Date of birth" value={fmtDate(patient.dateOfBirth)} />
            <Info label="Age" value={ageFromDob(patient.dateOfBirth)} />
            <Info label="Blood group" value={patient.bloodGroup} />
            <Info label="Marital status" value={patient.maritalStatus} />
            <Info label="Occupation" value={patient.occupation} />
            <Info label="Guardian" value={patient.guardianName} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Info label="Phone" value={patient.phone} />
            <Info label="Email" value={patient.email} />
            <Info label="Address" value={patient.address} />
            <Info label="Emergency" value={patient.emergencyName} />
            <Info label="Emergency phone" value={patient.emergencyPhone} />
            <Info label="Referral" value={patient.referralSource} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Medical summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Info label="Allergies" value={mh?.allergies} />
            <Info label="Conditions" value={mh?.conditions} />
            <Info label="Current medications" value={mh?.medications} />
            <Info label="Habits" value={mh?.habits} />
            <div className="flex gap-2 text-xs">
              {mh?.premedRequired && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Premed required</span>}
              {mh?.isPregnant && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">Pregnant</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
