import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { fbTrack, fbTrackCustom, fbCookies, newEventId } from './meta';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'OWNER' | 'ADMIN' | 'ASSISTANT';
  permissions?: string[];
  tenant?: Tenant | null;
}

export interface SubStatus {
  active: boolean; // false ONLY when suspended
  isPaid: boolean; // true = Pro; false = FREE tier
  status: string; // FREE | ACTIVE | PAST_DUE | SUSPENDED
  currentPeriodEnd: string | null;
  daysLeft: number | null;
  amount: number;
  bkashNumber: string;
  whatsapp: string;
  isTrial: boolean;
  pendingPayment?: boolean;
  // Meta: set once, the first time an activated clinic loads (offline purchase)
  trackPurchase?: boolean;
  purchaseEventId?: string;
  purchaseValue?: number;
}

export interface SignupPayload {
  clinicName: string;
  ownerName: string;
  phone: string;
  email?: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sub: SubStatus | null;
  blocked: boolean; // subscription inactive → show paywall
  login: (phone: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
  can: (cap: string) => boolean; // owner/admin = always; assistant = granted only
  isPaid: boolean; // Pro subscription active (else FREE tier — feature-limited)
  refreshSub: () => Promise<SubStatus | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [blocked, setBlocked] = useState(false);

  const refreshSub = useCallback(async (): Promise<SubStatus | null> => {
    try {
      const { data } = await api.get<SubStatus>('/subscription');
      setSub(data);
      setBlocked(!data.active);
      // The backend fires Purchase server-side (CAPI) the first time an activated
      // clinic loads. It hands us the same eventId so the browser pixel can mirror it
      // and Meta deduplicates (1 event from 2 sources).
      if (data.trackPurchase && data.purchaseEventId) {
        fbTrack('Purchase', { value: data.purchaseValue ?? 0, currency: 'BDT' }, data.purchaseEventId);
      }
      return data;
    } catch {
      return null; // e.g. logged out
    }
  }, []);

  // On load, if a token exists, validate it and fetch subscription status.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => setUser(r.data))
      .then(() => refreshSub())
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, [refreshSub]);

  // Any 402 from the API flips the paywall on.
  useEffect(() => {
    const onBlocked = () => {
      setBlocked(true);
      refreshSub();
    };
    window.addEventListener('subscription-blocked', onBlocked);
    return () => window.removeEventListener('subscription-blocked', onBlocked);
  }, [refreshSub]);

  // While the paywall is up, poll the subscription so the clinic drops straight into the
  // dashboard the moment the super-admin verifies the payment / grants days — no manual refresh.
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  useEffect(() => {
    if (!user || !blocked) return;
    const id = setInterval(() => { if (blockedRef.current) refreshSub(); }, 10000);
    const onFocus = () => { if (blockedRef.current) refreshSub(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus); };
  }, [user, blocked, refreshSub]);

  // Clinic disabled by super-admin → force logout so the user is bounced to the login screen
  // (which shows the "contact support" popup).
  useEffect(() => {
    const onSuspended = () => {
      setUser(null);
      setSub(null);
      setBlocked(false);
    };
    window.addEventListener('clinic-suspended', onSuspended);
    return () => window.removeEventListener('clinic-suspended', onSuspended);
  }, []);

  const login = async (phone: string, password: string) => {
    const { data } = await api.post('/auth/login', { phone, password });
    localStorage.setItem('token', data.access_token);
    setUser({ ...data.user, tenant: data.tenant });
    fbTrackCustom('Login');
    await refreshSub();
  };

  const signup = async (payload: SignupPayload) => {
    // Same eventId browser+server → Meta counts it once; fbp/fbc let Meta tie the
    // later offline purchase back to the ad click.
    const eventId = newEventId('reg');
    const signupEventId = newEventId('signup');
    const { fbp, fbc } = fbCookies();
    const { data } = await api.post('/auth/signup', { ...payload, fbp, fbc, eventId, signupEventId });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('dk_trial_welcome', '1'); // show the "trial started" dialog once
    setUser({ ...data.user, tenant: data.tenant });
    // Standard event (may be health-restricted by Meta) + a neutral custom event that isn't.
    fbTrack('CompleteRegistration', { content_name: 'clinic_signup' }, eventId);
    fbTrackCustom('ClinicSignup', { content_name: 'clinic_signup' }, signupEventId);
    await refreshSub();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSub(null);
    setBlocked(false);
  };

  const can = (cap: string) =>
    !!user && (user.role === 'OWNER' || user.role === 'ADMIN' || (user.permissions ?? []).includes(cap));

  return (
    <AuthContext.Provider value={{ user, loading, sub, blocked, login, signup, logout, can, isPaid: !!sub?.isPaid, refreshSub }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
