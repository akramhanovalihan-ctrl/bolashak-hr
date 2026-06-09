import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';

export default function Analytics() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.getAnalytics(year, month).then(setData); }, [year, month]);

  if (!data) return <div className="empty-state">Загрузка...</div>;

  return (
    <div>
      <h1 className="page-title">HR-аналитика</h1>
      <p className="page-subtitle">ФОТ, численность, нарушения</p>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>
      <div className="modules-grid">
        <div className="module-card"><div className="num">👥</div><h3>{data.total_employees}</h3><p>Активных сотрудников</p></div>
        <div className="module-card"><div className="num">₸</div><h3>{Number(data.total_fot).toLocaleString('ru-RU')}</h3><p>ФОТ за месяц</p></div>
        <div className="module-card"><div className="num">📋</div><h3>{data.pending_vacations}</h3><p>Заявок на отпуск</p></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><strong>Численность по подразделениям</strong></div>
        <table className="data-table">
          <thead><tr><th>Подразделение</th><th>Тип</th><th>Человек</th></tr></thead>
          <tbody>
            {(data.headcount_by_unit || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.name}</td><td>{r.unit_type}</td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><strong>ФОТ по подразделениям</strong></div>
        <table className="data-table">
          <thead><tr><th>Подразделение</th><th>Сумма</th></tr></thead>
          <tbody>
            {(data.fot_by_unit || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.name}</td><td>{Number(r.total || 0).toLocaleString('ru-RU')} ₸</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
