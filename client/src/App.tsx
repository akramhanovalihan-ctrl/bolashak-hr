import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Users from './pages/Users';
import Dashboard from './pages/Dashboard';
import Units from './pages/Units';
import Employees from './pages/Employees';
import Timesheets from './pages/Timesheets';
import Payroll from './pages/Payroll';
import Vacations from './pages/Vacations';
import Shifts from './pages/Shifts';
import Onboarding from './pages/Onboarding';
import Disciplinary from './pages/Disciplinary';
import Analytics from './pages/Analytics';
import Documents from './pages/Documents';
import Portal from './pages/Portal';
import OrgChart from './pages/OrgChart';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="units" element={<Units />} />
        <Route path="users" element={<Users />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="vacations" element={<Vacations />} />
        <Route path="shifts" element={<Shifts />} />
        <Route path="onboarding" element={<Onboarding />} />
        <Route path="disciplinary" element={<Disciplinary />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="documents" element={<Documents />} />
        <Route path="portal" element={<Portal />} />
        <Route path="org-chart" element={<OrgChart />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
