import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';

interface Drug { id: string; name: string; generic?: string; category?: string; form?: string; strength?: string; }
interface Proc { id: string; code: string; name: string; category?: string; defaultFee: number; }

export function Catalog() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Catalog</h1>
      <p className="mb-6 text-sm text-muted-foreground">Search, add, edit or remove medicines and procedures. Ships with 8,900+ BD dental medicines.</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Medicines />
        <Procedures />
      </div>
    </div>
  );
}

/* ---------------- Medicines ---------------- */
function Medicines() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: drugs = [] } = useQuery<Drug[]>({
    queryKey: ['drugs', search],
    enabled: search.length >= 2,
    queryFn: async () => (await api.get('/drugs', { params: { search } })).data,
  });
  const inval = () => qc.invalidateQueries({ queryKey: ['drugs'] });
  const create = useMutation({ mutationFn: async (b: any) => (await api.post('/drugs', b)).data, onSuccess: inval });
  const update = useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/drugs/${id}`, b)).data, onSuccess: inval });
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/drugs/${id}`)).data, onSuccess: inval });

  const [add, setAdd] = useState<Drug | null>(null);
  const blank: Drug = { id: '', name: '', generic: '', category: '', form: '', strength: '' };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Medicines</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdd(add ? null : { ...blank })}>
          <Plus className="h-4 w-4" /> Add medicine
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {add && (
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Brand" v={add.name} on={(v) => setAdd({ ...add, name: v })} />
              <Field label="Generic" v={add.generic} on={(v) => setAdd({ ...add, generic: v })} />
              <Field label="Category" v={add.category} on={(v) => setAdd({ ...add, category: v })} />
              <Field label="Form" v={add.form} on={(v) => setAdd({ ...add, form: v })} />
              <Field label="Strength" v={add.strength} on={(v) => setAdd({ ...add, strength: v })} />
            </div>
            <Button size="sm" className="mt-2" disabled={!add.name || create.isPending}
              onClick={() => create.mutate({ name: add.name, generic: add.generic, category: add.category, form: add.form, strength: add.strength }, { onSuccess: () => setAdd(null) })}>
              Save medicine
            </Button>
          </div>
        )}
        <Input placeholder="Search medicines (type 2+ letters)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[28rem] space-y-1 overflow-auto">
          {search.length < 2 && <p className="text-xs text-muted-foreground">Type to search the medicine database.</p>}
          {drugs.map((d) => (
            <DrugRow key={d.id} drug={d} onSave={(b) => update.mutate({ id: d.id, ...b })} onDelete={() => { if (confirm(`Remove ${d.name}?`)) remove.mutate(d.id); }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DrugRow({ drug, onSave, onDelete }: { drug: Drug; onSave: (b: any) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(drug);
  if (edit) {
    return (
      <div className="rounded-md border border-primary/40 p-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Brand" v={f.name} on={(v) => setF({ ...f, name: v })} />
          <Field label="Generic" v={f.generic} on={(v) => setF({ ...f, generic: v })} />
          <Field label="Category" v={f.category} on={(v) => setF({ ...f, category: v })} />
          <Field label="Form" v={f.form} on={(v) => setF({ ...f, form: v })} />
          <Field label="Strength" v={f.strength} on={(v) => setF({ ...f, strength: v })} />
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => { onSave({ name: f.name, generic: f.generic, category: f.category, form: f.form, strength: f.strength }); setEdit(false); }}><Check className="h-4 w-4" /> Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setF(drug); setEdit(false); }}><X className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded border-b border-border/40 px-1 py-1.5 text-sm">
      <span><b>{drug.name}</b> <span className="text-muted-foreground">{drug.generic} {drug.strength}{drug.form ? ` · ${drug.form}` : ''}</span></span>
      <span className="flex gap-1">
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
      </span>
    </div>
  );
}

/* ---------------- Procedures ---------------- */
function Procedures() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: procs = [] } = useQuery<Proc[]>({
    queryKey: ['procedures', search],
    queryFn: async () => (await api.get('/procedures', { params: { search } })).data,
  });
  // Procedure name shows live inside treatment plans → refresh those too on edit.
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['procedures'] });
    qc.invalidateQueries({ queryKey: ['treatment'] });
  };
  const create = useMutation({ mutationFn: async (b: any) => (await api.post('/procedures', b)).data, onSuccess: inval });
  const update = useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/procedures/${id}`, b)).data, onSuccess: inval });
  const remove = useMutation({ mutationFn: async (id: string) => (await api.delete(`/procedures/${id}`)).data, onSuccess: inval });

  const [add, setAdd] = useState<Proc | null>(null);
  const blank: Proc = { id: '', code: '', name: '', category: '', defaultFee: 0 };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Procedures</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdd(add ? null : { ...blank })}>
          <Plus className="h-4 w-4" /> Add procedure
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {add && (
          <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Code" v={add.code} on={(v) => setAdd({ ...add, code: v })} />
              <Field label="Name" v={add.name} on={(v) => setAdd({ ...add, name: v })} />
              <Field label="Category" v={add.category} on={(v) => setAdd({ ...add, category: v })} />
              <Field label="Default fee ৳" type="number" v={String(add.defaultFee || '')} on={(v) => setAdd({ ...add, defaultFee: Number(v) })} />
            </div>
            <Button size="sm" className="mt-2" disabled={!add.code || !add.name || create.isPending}
              onClick={() => create.mutate({ code: add.code, name: add.name, category: add.category, defaultFee: add.defaultFee }, { onSuccess: () => setAdd(null) })}>
              Save procedure
            </Button>
          </div>
        )}
        <Input placeholder="Search procedures…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[28rem] space-y-1 overflow-auto">
          {procs.map((p) => (
            <ProcRow key={p.id} proc={p} onSave={(b) => update.mutate({ id: p.id, ...b })} onDelete={() => { if (confirm(`Remove ${p.name}?`)) remove.mutate(p.id); }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProcRow({ proc, onSave, onDelete }: { proc: Proc; onSave: (b: any) => void; onDelete: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(proc);
  if (edit) {
    return (
      <div className="rounded-md border border-primary/40 p-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Code" v={f.code} on={(v) => setF({ ...f, code: v })} />
          <Field label="Name" v={f.name} on={(v) => setF({ ...f, name: v })} />
          <Field label="Category" v={f.category} on={(v) => setF({ ...f, category: v })} />
          <Field label="Default fee ৳" type="number" v={String(f.defaultFee || '')} on={(v) => setF({ ...f, defaultFee: Number(v) })} />
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => { onSave({ code: f.code, name: f.name, category: f.category, defaultFee: f.defaultFee }); setEdit(false); }}><Check className="h-4 w-4" /> Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setF(proc); setEdit(false); }}><X className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded border-b border-border/40 px-1 py-1.5 text-sm">
      <span><b>{proc.code}</b> {proc.name} <span className="text-muted-foreground">৳{proc.defaultFee}</span></span>
      <span className="flex gap-1">
        <button onClick={() => setEdit(true)} className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-danger"><Trash2 className="h-4 w-4" /></button>
      </span>
    </div>
  );
}

function Field({ label, v, on, type }: { label: string; v?: string; on: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={v || ''} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
