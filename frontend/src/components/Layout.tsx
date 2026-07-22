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
  PlayCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
import { bn } from '@/lib/pricing';
import { ToothIcon } from '@/components/ToothLogo';
import { TrialWelcome, TrialBanner } from '@/components/TrialBits';

const nav: { to: string; label: string; icon: any; end?: boolean; adminOnly?: boolean; cap?: string; divider?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: UsersIcon },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays, cap: 'appointments.manage' },
  { to: '/charting', label: 'Dental Chart', icon: Stethoscope, cap: 'charting.manage' },
  { to: '/reports', label: 'Reports', icon: FileText, cap: 'reports.view' },
  { to: '/tutorial', label: 'Tutorial', icon: PlayCircle },
  { to: '/catalog', label: 'Catalog', icon: Pill, adminOnly: true },
  { to: '/users', label: 'Users & Roles', icon: ShieldCheck, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { user, logout, can, sub } = useAuth();
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ToothIcon className="h-5 w-5" /></div>
            <span className="font-semibold">Dento Khata</span>
          </div>
          <button className="lg:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-auto p-3">
          {items.map(({ to, label, icon: Icon, end }, i) => (
            <div key={to}>
              {i > 0 && <div className="my-1 border-t border-border/60" />}
              <NavLink
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
            </div>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          {/* Subscription status + quick renew */}
          {sub && (
            <NavLink
              to="/subscribe"
              onClick={() => setOpen(false)}
              className="mb-2 block rounded-[var(--radius)] border border-border p-2.5 transition-colors hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{sub.isTrial ? 'ফ্রি ট্রায়াল' : 'সাবস্ক্রিপশন'}</span>
                <span className="text-xs font-semibold text-primary">নবায়ন →</span>
              </div>
              {sub.daysLeft != null && (
                <div className={cn('mt-0.5 text-sm font-bold', sub.daysLeft <= 3 ? 'text-danger' : 'text-foreground')}>
                  {bn(Math.max(0, sub.daysLeft))} দিন বাকি
                </div>
              )}
            </NavLink>
          )}
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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><ToothIcon className="h-4 w-4" /></div>
            <span className="font-semibold">Dento Khata</span>
          </div>
        </header>
        <TrialBanner />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <TrialWelcome />
    </div>
  );
}
