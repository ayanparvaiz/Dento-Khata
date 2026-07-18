import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '@/lib/patients';
import { ageFromDob } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Stethoscope } from 'lucide-react';

// Dental Chart is per-patient, so the sidebar entry is a patient picker that
// jumps straight to the patient's Dental Chart tab.
export function ChartingHome() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data } = usePatients(search);
  const patients = data?.items ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Dental Chart</h1>
      <p className="mb-6 text-sm text-muted-foreground">Select a patient to open their odontogram.</p>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search patient…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="zebra p-0">
          {patients.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/patients/${p.id}?tab=Dental%20Chart`)}
              className="flex w-full items-center gap-3 border-b border-border/60 p-3 text-left text-sm hover:bg-muted"
            >
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs">{p.code}</span>
              <span className="font-medium">{p.fullName}</span>
              <span className="text-muted-foreground">{p.gender} · {ageFromDob(p.dateOfBirth)}</span>
            </button>
          ))}
          {patients.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">No patients found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
