import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV, canAccess } from '../config/nav';
import NotificationBell from './NotificationBell';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const role = user?.role || '';

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">ИП Дюсипов Р.Т.<span>HR v2.0</span></div>
        <div className="header-user">
          <NotificationBell />
          <span className="role-badge">{ROLE_LABELS[role] || role}</span>
          <span>{user?.full_name}</span>
          <button className="btn btn-secondary" onClick={() => logout()} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Выйти</button>
        </div>
      </header>
      <div className="app-body">
        <nav className="sidebar">
          {NAV.filter((item) => canAccess(item, role)).map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
