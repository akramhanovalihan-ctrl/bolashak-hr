import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  { num: 1, title: 'База сотрудников', desc: 'Карточки, документы, история', phase: 1, path: '/employees' },
  { num: 2, title: 'Табель', desc: 'Часы, явки, отсутствия', phase: 1, path: '/timesheets' },
  { num: 3, title: 'ЗП ведомость', desc: 'Расчёт, авансы, выплаты', phase: 1, path: '/payroll' },
  { num: 4, title: 'Отпуска и больничные', desc: 'Заявки, балансы, график', phase: 2, path: '/vacations' },
  { num: 5, title: 'График смен', desc: 'Планирование, нормы часов', phase: 2, path: '/shifts' },
  { num: 6, title: 'Онбординг / Офбординг', desc: 'Чеклисты, задачи, доступы', phase: 2, path: '/onboarding' },
  { num: 7, title: 'Дисциплина', desc: 'Штрафы, нарушения, удержания', phase: 2, path: '/disciplinary' },
  { num: 8, title: 'HR-аналитика', desc: 'ФОТ, текучесть, KPI', phase: 3, path: '/analytics' },
  { num: 9, title: 'Документы', desc: 'Договоры, приказы, шаблоны', phase: 3, path: '/documents' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="page-title">Добро пожаловать, {user?.full_name?.split(' ')[0]}</h1>
      <p className="page-subtitle">Болашак HR · Все модули активны · 11 подразделений</p>
      <div className="modules-grid">
        {MODULES.map((mod) => (
          <Link key={mod.num} to={mod.path} className="module-card active">
            <span className={`phase-badge p${mod.phase}`}>Фаза {mod.phase}</span>
            <div className="num">{mod.num}</div>
            <h3>{mod.title}</h3>
            <p>{mod.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
