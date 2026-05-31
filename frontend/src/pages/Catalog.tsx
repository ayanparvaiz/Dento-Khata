import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDrugs } from '@/lib/clinical';
import { useProcedures } from '@/lib/treatment';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Catalog() {
  const qc = useQueryClient();
  const [drugSearch, setDrugSearch] = useState('');
  const { data: drugs = [] } = useDrugs(drugSearch);
  const { data: procedures = [] } = useProcedures();

  const [drug, setDrug] = useState({ name: '', generic: '', category: '', form: '', strength: '' });
  const [proc, setProc] = useState({ code: '', name: '', category: '', defaultFee: '' });

  const addDrug = useMutation({
    mutationFn: async () => (await api.post('/drugs', drug)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drugs'] }); setDrug({ name: '', generic: '', category: '', form: '', strength: '' }); },
  });
  const addProc = useMutation({
    mutationFn: async () => (await api.post('/procedures', { ...proc, defaultFee: Number(proc.defaultFee) || 0 })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['procedures'] }); setProc({ code: '', name: '', category: '', defaultFee: '' }); },
  });

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Catalog</h1>
      <p className="mb-6 text-sm text-muted-foreground">Manually add medicines or procedures (admin). The app ships with 8,900+ dental medicines.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Drugs */}
        <Card>
          <CardHeader><CardTitle>Add medicine</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Brand name</Label><Input value={drug.name} onChange={(e) => setDrug({ ...drug, name: e.target.value })} /></div>
              <div><Label>Generic</Label><Input value={drug.generic} onChange={(e) => setDrug({ ...drug, generic: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={drug.category} onChange={(e) => setDrug({ ...drug, category: e.target.value })} /></div>
              <div><Label>Form</Label><Input value={drug.form} onChange={(e) => setDrug({ ...drug, form: e.target.value })} /></div>
              <div><Label>Strength</Label><Input value={drug.strength} onChange={(e) => setDrug({ ...drug, strength: e.target.value })} /></div>
            </div>
            <Button size="sm" disabled={!drug.name || addDrug.isPending} onClick={() => addDrug.mutate()}>Add medicine</Button>
            <div className="pt-2">
              <Input placeholder="Search medicines…" value={drugSearch} onChange={(e) => setDrugSearch(e.target.value)} />
              <div className="mt-2 max-h-56 overflow-auto text-sm">
                {drugs.slice(0, 50).map((d) => (
                  <div key={d.id} className="border-b border-border/40 py-1"><b>{d.name}</b> <span className="text-muted-foreground">{d.generic} {d.strength}</span></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Procedures */}
        <Card>
          <CardHeader><CardTitle>Add procedure</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Code</Label><Input value={proc.code} onChange={(e) => setProc({ ...proc, code: e.target.value })} /></div>
              <div><Label>Name</Label><Input value={proc.name} onChange={(e) => setProc({ ...proc, name: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={proc.category} onChange={(e) => setProc({ ...proc, category: e.target.value })} /></div>
              <div><Label>Default fee (৳)</Label><Input type="number" value={proc.defaultFee} onChange={(e) => setProc({ ...proc, defaultFee: e.target.value })} /></div>
            </div>
            <Button size="sm" disabled={!proc.code || !proc.name || addProc.isPending} onClick={() => addProc.mutate()}>Add procedure</Button>
            <div className="mt-2 max-h-56 overflow-auto text-sm">
              {procedures.map((p) => (
                <div key={p.id} className="flex justify-between border-b border-border/40 py-1"><span><b>{p.code}</b> {p.name}</span><span className="text-muted-foreground">৳{p.defaultFee}</span></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
