import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, ShieldCheck } from 'lucide-react';

interface User { id: string; phone: string; username?: string; fullName: string; role: string; isActive: boolean; permissions?: string[]; }
interface Cap { key: string; label: string; }

export function Users() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: async () => (await api.get('/users')).data });
  const { data: caps = [] } = useQuery<Cap[]>({ queryKey: ['capabilities'], queryFn: async () => (await api.get('/users/capabilities')).data });

  const [form, setForm] = useState<{ phone: string; password: string; fullName: string; role: string; permissions: string[] }>(
    { phone: '', password: '', fullName: '', role: 'ASSISTANT', permissions: [] },
  );
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: async () => (await api.post('/users', form)).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setForm({ phone: '', password: '', fullName: '', role: 'ASSISTANT', permissions: [] }); setError(''); },
    onError: (e: any) => setError(e?.response?.data?.message || 'Failed to create user'),
  });
  const update = useMutation({
    mutationFn: async ({ id, ...body }: any) => (await api.patch(`/users/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const toggleFormCap = (k: string) =>
    setForm((f) => ({ ...f, permissions: f.permissions.includes(k) ? f.permissions.filter((x) => x !== k) : [...f.permissions, k] }));

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-bold">Users &amp; Roles</h1>
      <p className="mb-6 text-sm text-muted-foreground">Admin can do everything. An assistant can only do what you tick below.</p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Add user */}
        <Card className="lg:col-span-1 self-start">
          <CardHeader><CardTitle>Add user</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Full name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div><Label>Phone (login)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" inputMode="tel" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="ASSISTANT">Assistant</option>
                <option value="ADMIN">Admin (full access)</option>
              </Select>
            </div>
            {form.role === 'ASSISTANT' && (
              <div className="rounded-md border border-border p-2">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Allowed actions</div>
                <div className="space-y-1">
                  {caps.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.permissions.includes(c.key)} onChange={() => toggleFormCap(c.key)} />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>Add user</Button>
          </CardContent>
        </Card>

        {/* Existing users */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>All users ({users.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.map((u) => (
              <UserRow key={u.id} user={u} caps={caps} onUpdate={(body) => update.mutate({ id: u.id, ...body })} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserRow({ user, caps, onUpdate }: { user: User; caps: Cap[]; onUpdate: (b: any) => void }) {
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(user.permissions ?? []);
  // Reflect the user's saved permissions (re-sync when the list refetches).
  useEffect(() => { setPerms(user.permissions ?? []); }, [JSON.stringify(user.permissions)]);
  const toggle = (k: string) => setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{user.fullName} <span className="text-xs text-muted-foreground">{user.phone}</span></div>
          <div className="text-xs">
            <span className={`rounded-full px-2 py-0.5 ${user.role === 'ADMIN' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>{user.role}</span>
            {!user.isActive && <span className="ml-2 text-muted-foreground">inactive</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.role === 'ASSISTANT' && (
            <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
              <ShieldCheck className="h-4 w-4" /> Permissions
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onUpdate({ isActive: !user.isActive })}>
            {user.isActive ? <Trash2 className="h-4 w-4" /> : 'Activate'}
          </Button>
        </div>
      </div>

      {open && user.role === 'ASSISTANT' && (
        <div className="mt-3 rounded-md bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-1">
            {caps.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={perms.includes(c.key)} onChange={() => toggle(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-2" onClick={() => { onUpdate({ permissions: perms }); setOpen(false); }}>Save permissions</Button>
        </div>
      )}
    </div>
  );
}
