import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users as UsersIcon,
  CalendarDays,
  Stethoscope,
  Pill,
  Receipt,
  Images,
  FileText,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';

// Nav mirrors the roadmap modules. `adminOnly` items show only for ADMIN.
const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: UsersIcon },
  { to: '/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/charting', label: 'Dental Chart', icon: Stethoscope },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/catalog', label: 'Catalog', icon: Pill, adminOnly: true },
  { to: '/users', label: 'Users & Roles', icon: ShieldCheck, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Layout() {
  const { user, logout } = useAuth();
  const items = nav.filter((n) => !n.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            D
          </div>
          <span className="font-semibold">Dental Manager</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
