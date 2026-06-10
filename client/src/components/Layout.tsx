import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

type NavItem = { to: string; label: string; end?: boolean; roles?: string[] };

const NAV: NavItem[] = [
  { to: '/', label: 'Главная', end: true },
  { to: '/employees', label: 'База сотрудников' },
  { to: '/units', label: 'Подразделения' },
  { to: '/users', label: 'Пользователи', roles: ['admin', 'hr'] },
  { to: '/timesheets', label: 'Табель' },
  { to: '/payroll', label: 'ЗП ведомость' },
  { to: '/vacations', label: 'Отпуска' },
  { to: '/shifts', label: 'График смен' },
  { to: '/onboarding', label: 'Онбординг' },
  { to: '/disciplinary', label: 'Дисциплина' },
  { to: '/analytics', label: 'HR-аналитика' },
  { to: '/documents', label: 'Документы' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">Болашак HR<span>bolashaq-srv</span></div>
        <div className="header-user">
          <span className="role-badge">{ROLE_LABELS[user?.role || ''] || user?.role}</span>
          <span>{user?.full_name}</span>
          <button className="btn btn-secondary" onClick={() => logout()} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Выйти</button>
        </div>
      </header>
      <div className="app-body">
        <nav className="sidebar">
          {NAV.filter((item) => !item.roles || item.roles.includes(user?.role || '')).map((item) => (
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
