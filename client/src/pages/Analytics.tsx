import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';

export default function Analytics() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.getAnalytics(year, month)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [year, month]);

  if (loading) return <div className="empty-state">Загрузка...</div>;
  if (error) return <div className="empty-state"><div className="error-msg">{error}</div><button className="btn btn-secondary" onClick={load}>Повторить</button></div>;
  if (!data) return <div className="empty-state">Нет данных</div>;

  return (
    <div>
      <h1 className="page-title">HR-аналитика</h1>
      <p className="page-subtitle">ФОТ, численность, нарушения, испытательный срок</p>
      <div className="card-header" style={{ marginBottom: 16 }}>
        <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>
      <div className="modules-grid">
        <div className="module-card"><div className="num">👥</div><h3>{data.total_employees}</h3><p>Активных сотрудников</p></div>
        <div className="module-card"><div className="num">₸</div><h3>{Number(data.total_fot).toLocaleString('ru-RU')}</h3><p>ФОТ за месяц</p></div>
        <div className="module-card"><div className="num">📋</div><h3>{data.pending_vacations}</h3><p>Заявок на отпуск</p></div>
        <div className="module-card"><div className="num">💵</div><h3>{Number(data.avg_salary || 0).toLocaleString('ru-RU')}</h3><p>Средняя ЗП</p></div>
      </div>

      {(data.violations_by_type || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><strong>Нарушения по типам ({data.year})</strong></div>
          <TableScroll><table className="data-table">
            <thead><tr><th>Тип</th><th>Количество</th></tr></thead>
            <tbody>
              {data.violations_by_type.map((r: any, i: number) => (
                <tr key={i}><td>{r.label || r.violation_type}</td><td>{r.count}</td></tr>
              ))}
            </tbody>
          </table></TableScroll>
        </div>
      )}

      {(data.probation_ending || []).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><strong>Испытательный срок заканчивается (30 дней)</strong></div>
          <TableScroll><table className="data-table">
            <thead><tr><th>Сотрудник</th><th>Должность</th><th>Дата окончания</th></tr></thead>
            <tbody>
              {data.probation_ending.map((r: any, i: number) => (
                <tr key={i}><td>{r.full_name}</td><td>{r.position}</td><td>{r.probation_end_date}</td></tr>
              ))}
            </tbody>
          </table></TableScroll>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><strong>Численность по подразделениям</strong></div>
        <TableScroll><table className="data-table">
          <thead><tr><th>Подразделение</th><th>Тип</th><th>Человек</th></tr></thead>
          <tbody>
            {(data.headcount_by_unit || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.name}</td><td>{r.unit_type}</td><td>{r.count}</td></tr>
            ))}
          </tbody>
        </table></TableScroll>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header"><strong>ФОТ по подразделениям</strong></div>
        <TableScroll><table className="data-table">
          <thead><tr><th>Подразделение</th><th>Сумма</th></tr></thead>
          <tbody>
            {(data.fot_by_unit || []).map((r: any, i: number) => (
              <tr key={i}><td>{r.name}</td><td>{Number(r.total || 0).toLocaleString('ru-RU')} ₸</td></tr>
            ))}
          </tbody>
        </table></TableScroll>
      </div>
    </div>
  );
}
