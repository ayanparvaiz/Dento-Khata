import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<PatientsList />} />
            <Route path="patients/new" element={<PatientForm />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="patients/:id/edit" element={<PatientForm />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="charting" element={<ChartingHome />} />
            <Route path="reports" element={<Reports />} />
            <Route
              path="catalog"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Catalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
