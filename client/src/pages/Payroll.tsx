import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
import { useAuth } from '../context/AuthContext';

export default function Payroll() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [tab, setTab] = useState<'payroll' | 'advances'>('payroll');
  const canEdit = user?.role === 'admin' || user?.role === 'finance';

  const load = async () => {
    const [p, a] = await Promise.all([api.getPayroll(year, month), api.getAdvances(year, month)]);
    setPayroll(p.payroll); setAdvances(a.advances);
  };

  useEffect(() => { load(); }, [year, month]);

  return (
    <div>
      <h1 className="page-title">ЗП ведомость</h1>
      <p className="page-subtitle">Расчёт зарплаты и авансы</p>
      <div className="card">
        <div className="card-header">
          <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <div className="filters">
            <button className={`btn ${tab === 'payroll' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('payroll')}>Ведомость</button>
            <button className={`btn ${tab === 'advances' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('advances')}>Авансы</button>
            {canEdit && <button className="btn btn-primary" onClick={() => api.generatePayroll(year, month).then(load)}>Рассчитать ЗП</button>}
          </div>
        </div>
        {tab === 'payroll' ? (
          <table className="data-table">
            <thead><tr><th>Сотрудник</th><th>Подразделение</th><th>Начислено</th><th>Аванс</th><th>Удержания</th><th>Итого</th><th>Статус</th></tr></thead>
            <tbody>
              {payroll.length === 0 ? <tr><td colSpan={7} className="empty-state">Нет данных. Утвердите табели и нажмите «Рассчитать ЗП».</td></tr> :
                payroll.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.full_name}</td><td>{p.unit_name}</td>
                    <td>{Number(p.base_salary).toLocaleString('ru-RU')} ₸</td>
                    <td>{Number(p.advance_paid).toLocaleString('ru-RU')} ₸</td>
                    <td>{Number(p.deductions).toLocaleString('ru-RU')} ₸</td>
                    <td><strong>{Number(p.final_amount).toLocaleString('ru-RU')} ₸</strong></td>
                    <td>{p.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead><tr><th>Сотрудник</th><th>Запрошено</th><th>Макс.</th><th>Статус</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {advances.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.full_name}</td>
                  <td>{Number(a.requested_amount).toLocaleString('ru-RU')} ₸</td>
                  <td>{Number(a.max_allowed).toLocaleString('ru-RU')} ₸</td>
                  <td>{a.status}</td>
                  {canEdit && a.status === 'pending' && (
                    <td><button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => api.approveAdvance(a.id, 'approved', a.requested_amount).then(load)}>Одобрить</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
