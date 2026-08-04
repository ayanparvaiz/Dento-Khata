import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Wifi, Copy, Check } from 'lucide-react';

interface LanInfo { enabled: boolean; port: number; addresses: string[]; urls: string[] }

// Offline-only screen: shows the LAN address (+ QR) other devices on the same WiFi use to
// reach this server PC. Scanning the QR opens the URL directly; the IP is printed below it.
export function ConnectDevice() {
  const [info, setInfo] = useState<LanInfo | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<LanInfo>('/offline/lan').then((r) => setInfo(r.data)).catch(() => setInfo({ enabled: true, port: 0, addresses: [], urls: [] }));
  }, []);

  const url = info?.urls?.[0] || '';
  useEffect(() => {
    if (!url) { setQr(''); return; }
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#0f766e', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [url]);

  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold sm:text-2xl">অন্য ডিভাইস যুক্ত করুন</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        রিসেপশন/অ্যাসিস্ট্যান্ট তাদের ফোন বা ট্যাব থেকেও এই সফটওয়্যার ব্যবহার করতে পারবে — একই WiFi-তে থেকে।
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* QR + address */}
        <Card className="self-start">
          <CardHeader><CardTitle className="text-base">স্ক্যান করুন বা ঠিকানা লিখুন</CardTitle></CardHeader>
          <CardContent>
            {url ? (
              <div className="flex flex-col items-center gap-4">
                {qr && <img src={qr} alt="QR" className="h-56 w-56 rounded-lg border border-border" />}
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">এই ঠিকানায় ঢুকুন</div>
                  <button onClick={copy} title="কপি করুন"
                    className="mt-1 inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1.5 font-mono text-lg font-bold text-teal-800 ring-1 ring-teal-200 hover:bg-teal-100">
                    {url}
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 opacity-70" />}
                  </button>
                </div>
                {info && info.addresses.length > 1 && (
                  <div className="text-center text-xs text-muted-foreground">
                    কাজ না করলে অন্যটি চেষ্টা করুন:{' '}
                    {info.urls.slice(1).map((u) => <span key={u} className="mx-1 font-mono">{u}</span>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                <Wifi className="mb-1 inline h-4 w-4" /> WiFi/নেটওয়ার্ক ঠিকানা পাওয়া যায়নি। এই কম্পিউটারটি WiFi বা রাউটারে যুক্ত আছে কিনা দেখুন।
              </div>
            )}
          </CardContent>
        </Card>

        {/* How-to */}
        <Card className="self-start">
          <CardHeader><CardTitle className="text-base">কীভাবে যুক্ত করবেন</CardTitle></CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm text-foreground">
              <li>অন্য ফোন/ট্যাব <b>একই WiFi</b>-তে যুক্ত করুন (এই কম্পিউটার যে WiFi-তে আছে)।</li>
              <li>ফোনের <b>ক্যামেরা</b> দিয়ে উপরের <b>QR কোড স্ক্যান</b> করুন — অথবা ব্রাউজারে ঠিকানাটি লিখুন।</li>
              <li>লগইন পেজ আসবে → ঐ ব্যক্তির <b>নিজের ফোন নম্বর ও পাসওয়ার্ড</b> দিয়ে ঢুকবে।</li>
              <li>তার রোল অনুযায়ী সে যা যা করার অনুমতি আছে সেটুকু দেখবে।</li>
            </ol>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200">
              <Smartphone className="mt-0.5 h-4 w-4 flex-none" />
              <span>নতুন ইউজার (রিসেপশন/অ্যাসিস্ট্যান্ট) তৈরি করতে <b>Users &amp; Roles</b>-এ যান — প্রত্যেকের আলাদা লগইন ও অনুমতি ঠিক করুন।</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              টিপস: রাউটারে এই কম্পিউটারের IP <b>fix/reserve</b> করে দিলে ঠিকানা আর বদলাবে না।
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
