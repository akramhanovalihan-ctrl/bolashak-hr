import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

const NAV = [
  { to: '/', label: 'Главная', end: true },
  { section: 'Фаза 1' },
  { to: '/employees', label: 'База сотрудников' },
  { to: '/units', label: 'Подразделения' },
  { to: '/timesheets', label: 'Табель' },
  { to: '/payroll', label: 'ЗП ведомость' },
  { section: 'Фаза 2' },
  { to: '/vacations', label: 'Отпуска' },
  { to: '/shifts', label: 'График смен' },
  { to: '/onboarding', label: 'Онбординг' },
  { to: '/disciplinary', label: 'Дисциплина' },
  { section: 'Фаза 3' },
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
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink key={item.to} to={item.to!} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  );
}
