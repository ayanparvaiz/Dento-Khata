import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { letterheadHead, letterheadFoot, LETTERHEAD_CSS } from '@/lib/letterhead';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UpgradeInline } from '@/components/UpgradePrompt';

interface ClinicSettings {
  name: string;
  address?: string;
  phone?: string;
  letterhead?: string;
  logoPath?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerExtra?: string;
  footerLeft?: string;
  footerRight?: string;
  toothNotation: string;
  currency: string;
}

export function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const qc = useQueryClient();
  const { data } = useQuery<ClinicSettings>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  const [form, setForm] = useState<ClinicSettings | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => (await api.put('/settings', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (!form) return <div className="p-6 text-muted-foreground">Loading…</div>;
  const upd = (k: keyof ClinicSettings, v: string) => setForm({ ...form, [k]: v });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">Clinic Settings</h1>
      {isAdmin && <BackupCard />}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Clinic profile */}
        <Card>
          <CardHeader><CardTitle>Clinic profile</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
              <div><Label>Clinic name</Label><Input value={form.name} disabled={!isAdmin} onChange={(e) => upd('name', e.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Phone</Label><Input value={form.phone || ''} disabled={!isAdmin} onChange={(e) => upd('phone', e.target.value)} /></div>
                <div><Label>Currency</Label><Input value={form.currency} disabled={!isAdmin} onChange={(e) => upd('currency', e.target.value)} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address || ''} disabled={!isAdmin} onChange={(e) => upd('address', e.target.value)} /></div>
              <div><Label>Tooth notation</Label>
                <Select value={form.toothNotation} disabled={!isAdmin} onChange={(e) => upd('toothNotation', e.target.value)}>
                  <option value="FDI">FDI</option><option value="UNIVERSAL">Universal</option><option value="PALMER">Palmer</option>
                </Select>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
                  {saved && <span className="text-sm text-success">Saved ✓</span>}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Letterhead template — prescription + invoice */}
        <LetterheadCard form={form} setForm={setForm} isAdmin={isAdmin} onSave={() => save.mutate()} saving={save.isPending} saved={saved} qc={qc} />
      </div>
    </div>
  );
}

function LetterheadCard({ form, setForm, isAdmin, onSave, saving, saved, qc }: any) {
  const { isPaid } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upd = (k: string, v: string) => setForm({ ...form, [k]: v });

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post('/settings/logo', fd);
      setForm({ ...form, logoPath: r.data.logoPath });
      qc.invalidateQueries({ queryKey: ['settings'] });
    } finally { setUploading(false); }
  };

  // Remove must PERSIST immediately (upload does) — otherwise the logo reappears on reload.
  const removeLogo = async () => {
    const next = { ...form, logoPath: '' };
    setForm(next);
    await api.put('/settings', next);
    qc.invalidateQueries({ queryKey: ['settings'] });
  };

  // preview only: keep footer in-flow (print keeps it pinned to the page bottom)
  const previewHtml = `<style>${LETTERHEAD_CSS}.lh-ft{position:static !important;left:auto;right:auto;bottom:auto;margin-top:16px}</style>${letterheadHead(form)}
    <div style="height:60px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px">— prescription / invoice content —</div>${letterheadFoot(form)}`;

  return (
    <Card>
      <CardHeader><CardTitle>Letterhead template <span className="text-xs font-normal text-muted-foreground">(prescription &amp; invoice)</span></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Logo</Label>
          <div className="flex items-center gap-3">
            {form.logoPath
              ? <img src={(api.defaults.baseURL || '').replace(/\/api$/, '') + form.logoPath} alt="logo" className="h-14 w-14 rounded border border-border object-contain" />
              : <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">none</div>}
            {isAdmin && isPaid && (
              <>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }} />
                <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? 'Uploading…' : 'Upload logo'}</Button>
                {form.logoPath && <Button type="button" size="sm" variant="ghost" onClick={removeLogo}>Remove</Button>}
              </>
            )}
          </div>
          {isAdmin && !isPaid && (
            <div className="mt-2"><UpgradeInline text="নিজের লোগো যোগ করতে প্রো দরকার — হেডার, ফুটার সব ফ্রি-তেই আছে" /></div>
          )}
        </div>

        <div><Label>Header title (doctor / clinic name)</Label><Input value={form.headerTitle || ''} disabled={!isAdmin} placeholder="ডাঃ মোঃ তৌফিক হাসান" onChange={(e) => upd('headerTitle', e.target.value)} /></div>
        <div><Label>Header subtitle (designation / qualifications)</Label><Input value={form.headerSubtitle || ''} disabled={!isAdmin} placeholder="বিডিএস, মুখ ও দন্ত রোগ বিশেষজ্ঞ সার্জন" onChange={(e) => upd('headerSubtitle', e.target.value)} /></div>
        <div><Label>Header extra line (optional)</Label><Input value={form.headerExtra || ''} disabled={!isAdmin} onChange={(e) => upd('headerExtra', e.target.value)} /></div>
        <div>
          <Label>Theme colour (prescription &amp; invoice)</Label>
          <div className="flex items-center gap-2">
            <input type="color" disabled={!isAdmin} value={form.themeColor || '#0f766e'} onChange={(e) => upd('themeColor', e.target.value)} className="h-9 w-12 rounded border border-border" />
            <Input className="w-32" disabled={!isAdmin} value={form.themeColor || '#0f766e'} onChange={(e) => upd('themeColor', e.target.value)} />
            {['#0f766e', '#1d4ed8', '#9333ea', '#b91c1c', '#0f172a'].map((c) => (
              <button key={c} type="button" disabled={!isAdmin} onClick={() => upd('themeColor', c)} className="h-6 w-6 rounded-full border border-border" style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Footer left (clinic, address)</Label><textarea className="min-h-[60px] w-full rounded-md border border-border p-2 text-sm" disabled={!isAdmin} placeholder={'ফ্রেন্ডস ডেন্টাল কেয়ার\nমদিনা প্লাজা, সৈয়দপুর'} value={form.footerLeft || ''} onChange={(e) => upd('footerLeft', e.target.value)} /></div>
          <div><Label>Footer right (phone, visit hours)</Label><textarea className="min-h-[60px] w-full rounded-md border border-border p-2 text-sm" disabled={!isAdmin} placeholder={'০১৭৫৮-৫৪২৮২৯\nসকাল ১০টা–দুপুর ২টা'} value={form.footerRight || ''} onChange={(e) => upd('footerRight', e.target.value)} /></div>
        </div>

        <div>
          <Label>Preview</Label>
          <div className="rounded-lg border border-border bg-white p-4" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save template'}</Button>
            {saved && <span className="text-sm text-success">Saved ✓</span>}
            <span className="text-xs text-muted-foreground">Pre-printed pad? use “Print (no header)”.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BackupCard() {
  const { isPaid } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Downloads THIS clinic's data (patients, appointments, treatments, prescriptions,
  // billing, notes) as one JSON file the owner can keep safe.
  const download = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dentokhata-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr('ব্যাকআপ ডাউনলোড করা যায়নি। আবার চেষ্টা করুন বা সাপোর্টে যোগাযোগ করুন।');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 max-w-2xl">
      <CardHeader><CardTitle>ডেটা ব্যাকআপ</CardTitle></CardHeader>
      <CardContent>
        {isPaid ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              আপনার ক্লিনিকের সব তথ্য — রোগী, অ্যাপয়েন্টমেন্ট, চিকিৎসা, প্রেসক্রিপশন, বিলিং — একটি ফাইলে ডাউনলোড করুন।
              <br />নিয়মিত ডাউনলোড করে নিরাপদ জায়গায় (পেনড্রাইভ/গুগল ড্রাইভ) রাখুন।
              {err && <span className="mt-1 block text-danger">{err}</span>}
            </div>
            <Button onClick={download} disabled={busy}>{busy ? 'ডাউনলোড হচ্ছে…' : 'ব্যাকআপ ডাউনলোড করুন'}</Button>
          </div>
        ) : (
          <UpgradeInline text="ডেটা ব্যাকআপ ডাউনলোড করতে প্রো দরকার" />
        )}
      </CardContent>
    </Card>
  );
}
