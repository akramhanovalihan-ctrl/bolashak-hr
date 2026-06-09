import { useEffect, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
import { useAuth } from '../context/AuthContext';

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

type PayrollRow = {
  id: string; full_name: string; position: string; unit_name: string;
  monthly_salary?: number; hours_norm?: number; hours_worked?: number;
  base_salary: number; bonuses: number; advance_paid: number;
  deductions: number; manual_deductions?: number; final_amount: number; status: string;
};

export default function Payroll() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [tab, setTab] = useState<'payroll' | 'bonuses' | 'advances'>('payroll');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canEdit = user?.role === 'admin' || user?.role === 'finance';

  useEffect(() => {
    api.getUnits().then(({ units: u }) => {
      setUnits(u);
      if (user?.unit_id) setUnitId(user.unit_id);
    });
  }, [user]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      await api.syncPayroll(year, month, unitId || undefined);
      const [p, a] = await Promise.all([
        api.getPayroll(year, month, unitId || undefined),
        api.getAdvances(year, month),
      ]);
      setPayroll(p.payroll as PayrollRow[]);
      setAdvances(a.advances);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month, unitId]);

  const fmt = (n: number) => Number(n || 0).toLocaleString('ru-RU');

  const updateBonus = async (row: PayrollRow, bonuses: number) => {
    await api.updatePayroll(row.id, { bonuses });
    await load();
  };

  const totalFot = payroll.reduce((s, p) => s + Number(p.final_amount), 0);

  return (
    <div>
      <h1 className="page-title">ЗП ведомость</h1>
      <p className="page-subtitle">
        {MONTHS[month - 1]} {year} — автоматический расчёт из табеля по подразделениям
      </p>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Все подразделения</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            <button className={`btn ${tab === 'payroll' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('payroll')}>Ведомость</button>
            <button className={`btn ${tab === 'bonuses' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bonuses')}>Бонусы</button>
            <button className={`btn ${tab === 'advances' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('advances')}>Авансы</button>
            <button className="btn btn-secondary" onClick={load} disabled={loading}>Обновить</button>
          </div>
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Формирование ведомости из табеля...</div>
        ) : tab === 'payroll' ? (
          <>
            <div className="timesheet-meta">
              <span>Сотрудников: <strong>{payroll.length}</strong></span>
              <span>ФОТ к выплате: <strong>{fmt(totalFot)} ₸</strong></span>
              <span className="form-hint">Данные подтягиваются из табеля автоматически</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ФИО</th><th>Должность</th><th>Подразделение</th>
                    <th>Оклад</th><th>План ч</th><th>Факт ч</th>
                    <th>Начислено</th><th>Бонусы</th><th>Аванс</th><th>Удержания</th><th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={11} className="empty-state">Нет сотрудников в выбранном подразделении</td></tr>
                  ) : payroll.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.full_name}</strong></td>
                      <td>{p.position}</td>
                      <td>{p.unit_name}</td>
                      <td>{fmt(p.monthly_salary || 0)} ₸</td>
                      <td>{p.hours_norm ?? '—'}</td>
                      <td><strong>{p.hours_worked ?? '—'}</strong></td>
                      <td>{fmt(p.base_salary)} ₸</td>
                      <td>{fmt(p.bonuses)} ₸</td>
                      <td>{fmt(p.advance_paid)} ₸</td>
                      <td>{fmt(Number(p.deductions) + Number(p.manual_deductions || 0))} ₸</td>
                      <td><strong>{fmt(p.final_amount)} ₸</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : tab === 'bonuses' ? (
          <table className="data-table">
            <thead>
              <tr><th>ФИО</th><th>Должность</th><th>Подразделение</th><th>Начислено</th><th>Бонус (₸)</th><th>Итого с бонусом</th></tr>
            </thead>
            <tbody>
              {payroll.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.full_name}</strong></td>
                  <td>{p.position}</td>
                  <td>{p.unit_name}</td>
                  <td>{fmt(p.base_salary)} ₸</td>
                  <td>
                    {canEdit ? (
                      <input
                        type="number"
                        className="timesheet-hour-input"
                        style={{ width: 100 }}
                        defaultValue={p.bonuses}
                        onBlur={(e) => updateBonus(p, Number(e.target.value) || 0)}
                      />
                    ) : `${fmt(p.bonuses)} ₸`}
                  </td>
                  <td><strong>{fmt(p.final_amount)} ₸</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead><tr><th>Сотрудник</th><th>Запрошено</th><th>Макс.</th><th>Статус</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {advances.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">Авансов нет</td></tr>
              ) : advances.map((a: any) => (
                <tr key={a.id}>
                  <td>{a.full_name}</td>
                  <td>{fmt(a.requested_amount)} ₸</td>
                  <td>{fmt(a.max_allowed)} ₸</td>
                  <td>{a.status}</td>
                  {canEdit && a.status === 'pending' && (
                    <td>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => api.approveAdvance(a.id, 'approved', a.requested_amount).then(load)}>
                        Одобрить
                      </button>
                    </td>
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
