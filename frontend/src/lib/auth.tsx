import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

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
  active: boolean;
  status: string; // PENDING | ACTIVE | PAST_DUE | SUSPENDED | NONE
  currentPeriodEnd: string | null;
  daysLeft: number | null;
  amount: number;
  bkashNumber: string;
  whatsapp: string;
  pendingPayment?: boolean;
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
    await refreshSub();
  };

  const signup = async (payload: SignupPayload) => {
    const { data } = await api.post('/auth/signup', payload);
    localStorage.setItem('token', data.access_token);
    setUser({ ...data.user, tenant: data.tenant });
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
    <AuthContext.Provider value={{ user, loading, sub, blocked, login, signup, logout, can, refreshSub }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
