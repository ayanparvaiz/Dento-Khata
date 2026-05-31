import { useNavigate } from 'react-router-dom';
import { useDashboard, taka } from '@/lib/clinical';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isError } = useDashboard();

  const stats = [
    { label: 'Patients', value: data?.patients ?? '—', to: '/patients' },
    { label: "Today's Appointments", value: data?.todayAppointments ?? '—', to: '/appointments' },
    { label: 'Pending Treatments', value: data?.pendingTreatments ?? '—', to: '/patients' },
    { label: 'Outstanding Dues', value: data ? taka(data.outstanding) : '—', to: '/reports' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {isError ? (
          <span className="text-danger">Backend unreachable — is the server PC running?</span>
        ) : (
          <span className="text-success">Connected ✓ · offline LAN</span>
        )}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="cursor-pointer transition hover:shadow-md" onClick={() => navigate(s.to)}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Quick start</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Register patients, chart teeth, plan treatment, prescribe (8,900+ BD medicines), bill, and book
          appointments — all offline on your clinic network.
        </CardContent>
      </Card>
    </div>
  );
}
