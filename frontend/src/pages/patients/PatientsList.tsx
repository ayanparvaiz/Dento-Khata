import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '@/lib/patients';
import { ageFromDob, fmtDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, UserPlus } from 'lucide-react';

export function PatientsList() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { data, isLoading } = usePatients(search);
  const patients = data?.items ?? [];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} registered</p>
        </div>
        <Button onClick={() => navigate('/patients/new')}>
          <Plus className="h-4 w-4" /> New patient
        </Button>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone, or patient ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Gender</th>
                <th className="p-3">Age</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Registered</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="cursor-pointer border-b border-border/60 hover:bg-muted"
                >
                  <td className="p-3 font-mono text-xs">{p.code}</td>
                  <td className="p-3 font-medium">{p.fullName}</td>
                  <td className="p-3">{p.gender ?? '—'}</td>
                  <td className="p-3">{ageFromDob(p.dateOfBirth)}</td>
                  <td className="p-3">{p.phone ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && patients.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <UserPlus className="h-8 w-8" />
              <p>{search ? 'No patients match your search.' : 'No patients yet. Add your first patient.'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
