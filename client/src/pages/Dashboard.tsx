import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  { title: 'Портал сотрудника', desc: 'Задачи, документы, отпуска', path: '/portal', icon: '🏠' },
  { title: 'Оргструктура', desc: 'Дерево подразделений и ролей', path: '/org-chart', icon: '🏢' },
  { title: 'База сотрудников', desc: 'Карточки, документы, история', path: '/employees', icon: '👥', roles: ['admin', 'hr', 'finance', 'manager'] },
  { title: 'Табель', desc: 'Часы, явки, отсутствия', path: '/timesheets', icon: '📅', roles: ['admin', 'hr', 'manager'] },
  { title: 'ЗП ведомость', desc: 'Расчёт, авансы, выплаты', path: '/payroll', icon: '💰', roles: ['admin', 'hr', 'finance'] },
  { title: 'Отпуска и больничные', desc: 'Заявки, балансы, график', path: '/vacations', icon: '🌴' },
  { title: 'График смен', desc: 'Планирование, нормы часов', path: '/shifts', icon: '🔄', roles: ['admin', 'hr', 'manager'] },
  { title: 'Онбординг / Офбординг', desc: 'Чеклисты, задачи, доступы', path: '/onboarding', icon: '✅' },
  { title: 'Дисциплина', desc: 'Штрафы, нарушения, удержания', path: '/disciplinary', icon: '⚠️', roles: ['admin', 'hr', 'finance', 'manager'] },
  { title: 'HR-аналитика', desc: 'ФОТ, текучесть, нарушения', path: '/analytics', icon: '📊', roles: ['admin', 'hr', 'finance'] },
  { title: 'Документы', desc: 'Приказы, договоры, публикация', path: '/documents', icon: '📄' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role || '';

  const visible = MODULES.filter((m) => !m.roles || m.roles.includes(role));

  return (
    <div>
      <h1 className="page-title">Добро пожаловать, {user?.full_name?.split(' ')[0]}</h1>
      <p className="page-subtitle">Болашак HR v2.0 · Уведомления · Портал · Оргструктура</p>
      <div className="modules-grid">
        {visible.map((mod) => (
          <Link key={mod.path} to={mod.path} className="module-card active">
            <div className="num">{mod.icon}</div>
            <h3>{mod.title}</h3>
            <p>{mod.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
