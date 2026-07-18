import { Navigate } from 'react-router-dom';
import { useAuth, type AuthUser } from '@/lib/auth';
import type { ReactNode } from 'react';

// Guards routes: redirects to /login if not authenticated.
// Optionally restricts to specific roles (e.g. ADMIN-only pages).
export function ProtectedRoute({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: AuthUser['role'][];
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  // OWNER has full access — treat it as satisfying any role requirement (incl. ADMIN-only pages).
  if (roles && user.role !== 'OWNER' && !roles.includes(user.role)) {
    return (
      <div className="grid h-full place-items-center text-danger">
        You don’t have permission to view this page.
      </div>
    );
  }
  return <>{children}</>;
}
