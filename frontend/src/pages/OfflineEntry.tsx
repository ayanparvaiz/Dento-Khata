import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Login } from '@/pages/Login';
import { LicenseSetup } from '@/pages/LicenseSetup';

// Offline, not-logged-in entry point: first launch (no clinic yet) → license setup;
// otherwise the normal login screen.
export function OfflineEntry() {
  const [state, setState] = useState<'loading' | 'setup' | 'login'>('loading');

  useEffect(() => {
    api.get<{ activated: boolean }>('/offline/license/status')
      .then((r) => setState(r.data.activated ? 'login' : 'setup'))
      .catch(() => setState('login')); // if unsure, fall back to login
  }, []);

  if (state === 'loading') return <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>;
  return state === 'setup' ? <LicenseSetup /> : <Login />;
}
