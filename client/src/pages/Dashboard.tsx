import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  { num: 1, title: 'База сотрудников', desc: 'Карточки, документы, история', path: '/employees' },
  { num: 2, title: 'Табель', desc: 'Часы, явки, отсутствия', path: '/timesheets' },
  { num: 3, title: 'ЗП ведомость', desc: 'Расчёт, авансы, выплаты', path: '/payroll' },
  { num: 4, title: 'Отпуска и больничные', desc: 'Заявки, балансы, график', path: '/vacations' },
  { num: 5, title: 'График смен', desc: 'Планирование, нормы часов', path: '/shifts' },
  { num: 6, title: 'Онбординг / Офбординг', desc: 'Чеклисты, задачи, доступы', path: '/onboarding' },
  { num: 7, title: 'Дисциплина', desc: 'Штрафы, нарушения, удержания', path: '/disciplinary' },
  { num: 8, title: 'HR-аналитика', desc: 'ФОТ, текучесть, KPI', path: '/analytics' },
  { num: 9, title: 'Документы', desc: 'Договоры, приказы, шаблоны', path: '/documents' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="page-title">Добро пожаловать, {user?.full_name?.split(' ')[0]}</h1>
      <p className="page-subtitle">Болашак HR · Актуальная база · 19 подразделений</p>
      <div className="modules-grid">
        {MODULES.map((mod) => (
          <Link key={mod.num} to={mod.path} className="module-card active">
            <div className="num">{mod.num}</div>
            <h3>{mod.title}</h3>
            <p>{mod.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
