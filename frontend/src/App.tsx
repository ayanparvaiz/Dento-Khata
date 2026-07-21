import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { Signup } from '@/pages/Signup';
import { Paywall } from '@/pages/Paywall';
import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';
import { Settings } from '@/pages/Settings';
import { PatientsList } from '@/pages/patients/PatientsList';
import { PatientForm } from '@/pages/patients/PatientForm';
import { PatientDetail } from '@/pages/patients/PatientDetail';
import { ChartingHome } from '@/pages/ChartingHome';
import { Appointments } from '@/pages/Appointments';
import { Reports } from '@/pages/Reports';
import { Catalog } from '@/pages/Catalog';
import { Tutorial } from '@/pages/Tutorial';
import { SuperAdmin } from '@/pages/superadmin/SuperAdmin';

// Root "/" gate:
//  - visitor (not logged in) → the marketing/signup landing page
//  - logged-in → the app shell (Layout), whose <Outlet/> renders the nested app routes
//  - subscription inactive → the Paywall
function RootGate() {
  const { user, loading, blocked } = useAuth();
  if (loading) return <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Signup />; // landing is the first page at "/"
  if (blocked) return <Paywall />;
  return <Layout />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} /> {/* alias for existing links */}
          <Route path="/superadmin/*" element={<SuperAdmin />} />

          <Route path="/" element={<RootGate />}>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<PatientsList />} />
            <Route path="patients/new" element={<PatientForm />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="patients/:id/edit" element={<PatientForm />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="charting" element={<ChartingHome />} />
            <Route path="reports" element={<Reports />} />
            <Route path="tutorial" element={<Tutorial />} />
            <Route path="catalog" element={<ProtectedRoute roles={['ADMIN']}><Catalog /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute roles={['ADMIN']}><Users /></ProtectedRoute>} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
