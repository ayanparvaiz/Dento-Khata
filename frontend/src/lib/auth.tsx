import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'ASSISTANT';
  permissions?: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  can: (cap: string) => boolean; // admin = always; assistant = granted only
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On load, if a token exists, validate it against the backend.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.access_token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const can = (cap: string) =>
    !!user && (user.role === 'ADMIN' || (user.permissions ?? []).includes(cap));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
