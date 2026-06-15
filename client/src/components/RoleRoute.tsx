import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess, type RouteAccess } from '../config/nav';

export default function RoleRoute({ access, children }: { access?: RouteAccess; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (access && !canAccess(access, user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
