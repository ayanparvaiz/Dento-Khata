import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users as UsersIcon,
  CalendarDays,
  Stethoscope,
  Pill,
  FileText,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

const nav: { to: string; label: string; icon: any; end?: boolean; adminOnly?: boolean; cap?: string }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: UsersIcon },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, cap: 'appointments.manage' },
  { to: '/charting', label: 'Dental Chart', icon: Stethoscope, cap: 'charting.manage' },
  { to: '/reports', label: 'Reports', icon: FileText, cap: 'reports.view' },
  { to: '/catalog', label: 'Catalog', icon: Pill, adminOnly: true },
  { to: '/users', label: 'Users & Roles', icon: ShieldCheck, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { user, logout, can } = useAuth();
  const [open, setOpen] = useState(false); // mobile drawer
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';
  const items = nav.filter((n) => (n.adminOnly ? isAdmin : n.cap ? can(n.cap) : true));

  return (
    <div className="flex h-full">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <aside
        className={cn(
          'fixed z-40 flex h-full w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">D</div>
            <span className="font-semibold">Dental Manager</span>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-1">
            <div className="text-sm font-medium">{user?.fullName}</div>
            <div className="text-xs text-muted-foreground">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar with hamburger */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">D</div>
            <span className="font-semibold">Dental Manager</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
