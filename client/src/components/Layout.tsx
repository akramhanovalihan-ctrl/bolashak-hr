import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

type NavItem = { to: string; label: string; end?: boolean; roles?: string[]; hideFor?: string[] };

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', end: true },
  { to: '/portal', label: 'Портал' },
  { to: '/org-chart', label: 'Оргструктура' },
  { to: '/employees', label: 'База сотрудников', hideFor: ['employee'] },
  { to: '/units', label: 'Подразделения', hideFor: ['employee'] },
  { to: '/users', label: 'Пользователи', roles: ['admin', 'hr'] },
  { to: '/timesheets', label: 'Табель', hideFor: ['employee', 'finance'] },
  { to: '/payroll', label: 'ЗП ведомость', roles: ['admin', 'hr', 'finance'] },
  { to: '/vacations', label: 'Отпуска' },
  { to: '/shifts', label: 'График смен', hideFor: ['employee', 'finance'] },
  { to: '/onboarding', label: 'Онбординг' },
  { to: '/disciplinary', label: 'Дисциплина', hideFor: ['employee'] },
  { to: '/analytics', label: 'HR-аналитика', roles: ['admin', 'hr', 'finance'] },
  { to: '/documents', label: 'Документы' },
];

function navVisible(item: NavItem, role: string) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.hideFor?.includes(role)) return false;
  return true;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const role = user?.role || '';

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">Болашак HR<span>v2.0</span></div>
        <div className="header-user">
          <NotificationBell />
          <span className="role-badge">{ROLE_LABELS[role] || role}</span>
          <span>{user?.full_name}</span>
          <button className="btn btn-secondary" onClick={() => logout()} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Выйти</button>
        </div>
      </header>
      <div className="app-body">
        <nav className="sidebar">
          {NAV.filter((item) => navVisible(item, role)).map((item) => (
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
