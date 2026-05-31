import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePatient } from '@/lib/patients';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

type FormState = Record<string, string>;
const EMPTY: FormState = {
  fullName: '',
  gender: '',
  dateOfBirth: '',
  bloodGroup: '',
  maritalStatus: '',
  occupation: '',
  phone: '',
  email: '',
  address: '',
  emergencyName: '',
  emergencyPhone: '',
  guardianName: '',
  referralSource: '',
};

export function PatientForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: existing } = usePatient(id);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (existing) {
      setForm({
        ...EMPTY,
        ...Object.fromEntries(
          Object.keys(EMPTY).map((k) => [
            k,
            k === 'dateOfBirth'
              ? (existing as any)[k]?.slice(0, 10) ?? ''
              : ((existing as any)[k] ?? ''),
          ]),
        ),
      });
    }
  }, [existing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    // Drop empty strings so optional fields stay null/valid.
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
    try {
      const res = isEdit
        ? await api.patch(`/patients/${id}`, payload)
        : await api.post('/patients', payload);
      qc.invalidateQueries({ queryKey: ['patients'] });
      qc.invalidateQueries({ queryKey: ['patient', id] });
      navigate(`/patients/${res.data.id}`);
    } catch (err: any) {
      const m = err?.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : m || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="mb-6 text-2xl font-bold">{isEdit ? 'Edit patient' : 'New patient'}</h1>

      <form onSubmit={submit} className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Full name *</Label>
              <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Select…</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
            <div>
              <Label>Blood group</Label>
              <Select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Marital status</Label>
              <Select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                <option value="">Select…</option>
                <option value="SINGLE">Single</option>
                <option value="MARRIED">Married</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label>Occupation</Label>
              <Input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
            </div>
            <div>
              <Label>Guardian (for minors)</Label>
              <Input value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </div>
            <div>
              <Label>Emergency contact name</Label>
              <Input value={form.emergencyName} onChange={(e) => set('emergencyName', e.target.value)} />
            </div>
            <div>
              <Label>Emergency contact phone</Label>
              <Input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Referral source</Label>
              <Input
                value={form.referralSource}
                placeholder="How did the patient find the clinic?"
                onChange={(e) => set('referralSource', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Register patient'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
