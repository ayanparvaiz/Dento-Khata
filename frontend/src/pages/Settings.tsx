import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ClinicSettings {
  name: string;
  address?: string;
  phone?: string;
  letterhead?: string;
  toothNotation: string;
  currency: string;
}

export function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();
  const { data } = useQuery<ClinicSettings>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  const [form, setForm] = useState<ClinicSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => (await api.put('/settings', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!form) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Clinic Settings</h1>
      {isAdmin && <BackupCard />}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Clinic profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div>
              <Label>Clinic name</Label>
              <Input
                value={form.name}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone || ''}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Currency</Label>
                <Input
                  value={form.currency}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address || ''}
                disabled={!isAdmin}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tooth notation</Label>
                <Select
                  value={form.toothNotation}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, toothNotation: e.target.value })}
                >
                  <option value="FDI">FDI</option>
                  <option value="UNIVERSAL">Universal</option>
                  <option value="PALMER">Palmer</option>
                </Select>
              </div>
            </div>
            <div>
              <Label>Prescription letterhead</Label>
              <Input
                value={form.letterhead || ''}
                disabled={!isAdmin}
                placeholder="Header text printed on prescriptions"
                onChange={(e) => setForm({ ...form, letterhead: e.target.value })}
              />
            </div>
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save settings'}
                </Button>
                {saved && <span className="text-sm text-success">Saved ✓</span>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Only an admin can change these settings.</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupCard() {
  const { data: info } = useQuery({ queryKey: ['backup-info'], queryFn: async () => (await api.get('/backup/info')).data });
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dental-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 max-w-2xl">
      <CardHeader><CardTitle>Backup</CardTitle></CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Database{info?.exists ? ` · ${info.sizeKB} KB · updated ${new Date(info.modified).toLocaleString()}` : ' not found'}.
          <br />Download a copy to a USB/pendrive regularly.
        </div>
        <Button onClick={download} disabled={busy}>{busy ? 'Exporting…' : 'Download backup'}</Button>
      </CardContent>
    </Card>
  );
}
