export type RouteAccess = { roles?: string[]; hideFor?: string[] };

export type NavItem = { to: string; label: string; end?: boolean } & RouteAccess;

export const NAV: NavItem[] = [
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

export function canAccess(access: RouteAccess, role: string) {
  if (access.roles && !access.roles.includes(role)) return false;
  if (access.hideFor?.includes(role)) return false;
  return true;
}

export const ROUTE_GUARDS: Record<string, RouteAccess> = {
  employees: { hideFor: ['employee'] },
  units: { hideFor: ['employee'] },
  users: { roles: ['admin', 'hr'] },
  timesheets: { hideFor: ['employee', 'finance'] },
  payroll: { roles: ['admin', 'hr', 'finance'] },
  shifts: { hideFor: ['employee', 'finance'] },
  disciplinary: { hideFor: ['employee'] },
  analytics: { roles: ['admin', 'hr', 'finance'] },
};
