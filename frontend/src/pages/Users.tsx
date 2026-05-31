import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

const ROLES = ['ADMIN', 'DENTIST', 'RECEPTIONIST', 'ASSISTANT'];

export function Users() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'RECEPTIONIST' });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: async () => (await api.post('/users', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ username: '', password: '', fullName: '', role: 'RECEPTIONIST' });
      setError('');
    },
    onError: (e: any) => setError(e?.response?.data?.message || 'Failed to create user'),
  });

  const toggle = useMutation({
    mutationFn: async (u: User) =>
      (await api.patch(`/users/${u.id}`, { isActive: !u.isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      (await api.patch(`/users/${id}`, { role })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Users &amp; Roles</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Add user</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div>
                <Label>Full name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div>
                <Label>Username</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? 'Adding…' : 'Add user'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>All users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Username</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{u.fullName}</td>
                      <td className="py-2 pr-3">{u.username}</td>
                      <td className="py-2 pr-3">
                        <Select
                          className="h-8 w-36"
                          value={u.role}
                          onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                        >
                          {ROLES.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            u.isActive ? 'text-success font-medium' : 'text-muted-foreground'
                          }
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => toggle.mutate(u)}>
                          {u.isActive ? <Trash2 className="h-4 w-4" /> : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
