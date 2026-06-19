import TableScroll from '../components/TableScroll';
import { useEffect, useMemo, useState } from 'react';
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
  const [unitsReady, setUnitsReady] = useState(false);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [tab, setTab] = useState<'summary' | 'payroll' | 'deductions' | 'bonuses' | 'advances'>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canEdit = user?.role === 'admin' || user?.role === 'finance' || user?.role === 'hr';
  const canRequestAdvance = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ employee_id: '', requested_amount: 0 });
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    api.getUnits().then(({ units: u }) => {
      setUnits(u);
      if (user?.unit_id) setUnitId(user.unit_id);
      else if (u[0]) setUnitId(u[0].id);
      setUnitsReady(true);
    });
    if (canRequestAdvance) {
      api.getEmployees().then(({ employees: e }) => setEmployees(e)).catch(() => {});
    }
  }, [user, canRequestAdvance]);

  const load = async (sync = false) => {
    if (!unitsReady) return;
    setLoading(true);
    setError('');
    try {
      if (sync) {
        await api.syncPayroll(year, month, unitId || undefined);
      }
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

  useEffect(() => { if (unitsReady) load(); }, [year, month, unitId, unitsReady]);

  const fmt = (n: number) => Number(n || 0).toLocaleString('ru-RU');

  const updateBonus = async (row: PayrollRow, bonuses: number) => {
    await api.updatePayroll(row.id, { bonuses });
    await load();
  };

  const updatePayrollField = async (row: PayrollRow, data: Partial<PayrollRow>) => {
    try {
      await api.updatePayroll(row.id, data);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  const totalFot = payroll.reduce((s, p) => s + Number(p.final_amount), 0);
  const totalHours = payroll.reduce((s, p) => s + Number(p.hours_worked || 0), 0);
  const totalAdvance = payroll.reduce((s, p) => s + Number(p.advance_paid || 0), 0);
  const totalBonuses = payroll.reduce((s, p) => s + Number(p.bonuses || 0), 0);
  const totalFines = payroll.reduce((s, p) => s + Number(p.deductions || 0), 0);
  const totalContributions = payroll.reduce((s, p) => s + Number(p.manual_deductions || 0), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, PayrollRow[]>();
    for (const row of payroll) {
      const list = map.get(row.unit_name) || [];
      list.push(row);
      map.set(row.unit_name, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ru'));
  }, [payroll]);

  return (
    <div>
      <h1 className="page-title">ЗП ведомость</h1>
      <p className="page-subtitle">
        {MONTHS[month - 1]} {year} — часы и авансы из табеля; оклад, план и отчисления — вручную (HR)
      </p>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            <button className={`btn ${tab === 'summary' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('summary')}>Сводная</button>
            <button className={`btn ${tab === 'payroll' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('payroll')}>Полная</button>
            <button className={`btn ${tab === 'deductions' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('deductions')}>Отчисления</button>
            <button className={`btn ${tab === 'bonuses' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('bonuses')}>Бонусы</button>
            <button className={`btn ${tab === 'advances' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('advances')}>Авансы</button>
            <button className="btn btn-secondary" onClick={() => load(true)} disabled={loading}>Обновить</button>
          </div>
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Формирование ведомости из табеля...</div>
        ) : tab === 'summary' ? (
          <>
            <div className="timesheet-meta">
              <span>Сотрудников: <strong>{payroll.length}</strong></span>
              <span>Факт часов: <strong>{totalHours}</strong></span>
              <span>Бонусы: <strong>{fmt(totalBonuses)} ₸</strong></span>
              <span>Авансы: <strong>{fmt(totalAdvance)} ₸</strong></span>
              <span>Штрафы: <strong>{fmt(totalFines)} ₸</strong></span>
              <span>Отчисления: <strong>{fmt(totalContributions)} ₸</strong></span>
              <span>К выплате: <strong>{fmt(totalFot)} ₸</strong></span>
            </div>
            <div className="timesheet-scroll">
              <table className="timesheet-grid timesheet-bolashak">
                <thead>
                  <tr className="timesheet-header-row">
                    <th>Подразделение</th>
                    <th>ФИО</th>
                    <th>Факт ч</th>
                    <th>Бонусы</th>
                    <th>Штраф</th>
                    <th>Отчисления</th>
                    <th>Аванс</th>
                    <th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={8} className="empty-state">Нет данных — заполните табель и нажмите «Обновить»</td></tr>
                  ) : grouped.flatMap(([unitName, rows]) =>
                    rows.map((p, idx) => (
                      <tr key={p.id}>
                        <td>{idx === 0 ? <strong>{unitName}</strong> : ''}</td>
                        <td><strong>{p.full_name}</strong></td>
                        <td>{p.hours_worked ?? '—'}</td>
                        <td>{fmt(p.bonuses)}</td>
                        <td>{fmt(p.deductions)}</td>
                        <td>{fmt(p.manual_deductions || 0)}</td>
                        <td>{fmt(p.advance_paid)}</td>
                        <td><strong>{fmt(p.final_amount)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="timesheet-hint">Сводная: часы, штраф и аванс из табеля. Отчисления и оклад — вкладка «Отчисления» (HR).</p>
          </>
        ) : tab === 'deductions' ? (
          <>
            <div className="timesheet-meta">
              <span>Сотрудников: <strong>{payroll.length}</strong></span>
              <span>Отчисления: <strong>{fmt(totalContributions)} ₸</strong></span>
              <span>К выплате: <strong>{fmt(totalFot)} ₸</strong></span>
            </div>
            {canEdit && (
              <p className="timesheet-hint" style={{ margin: '12px 16px 0' }}>
                Заполните оклад, плановые часы и отчисления вручную (как в Google Sheets). После утверждения табеля данные подтягиваются автоматически.
              </p>
            )}
            <TableScroll>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ФИО</th><th>Должность</th><th>Оклад</th><th>План ч</th><th>Факт ч</th>
                    <th>Начислено</th><th>Штраф</th><th>Аванс</th><th>Отчисления</th><th>Бонусы</th><th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={11} className="empty-state">Нет данных — утвердите табель или нажмите «Обновить»</td></tr>
                  ) : payroll.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.full_name}</strong></td>
                      <td>{p.position}</td>
                      <td>
                        {canEdit ? (
                          <input type="number" className="timesheet-money-input" style={{ width: 90 }}
                            defaultValue={p.monthly_salary || ''}
                            onBlur={(e) => updatePayrollField(p, { monthly_salary: Number(e.target.value) || 0 })}
                          />
                        ) : `${fmt(p.monthly_salary || 0)} ₸`}
                      </td>
                      <td>
                        {canEdit ? (
                          <input type="number" className="timesheet-money-input" style={{ width: 56 }}
                            defaultValue={p.hours_norm ?? ''}
                            onBlur={(e) => updatePayrollField(p, { hours_norm: Number(e.target.value) || 0 })}
                          />
                        ) : (p.hours_norm ?? '—')}
                      </td>
                      <td><strong>{p.hours_worked ?? '—'}</strong></td>
                      <td>{fmt(p.base_salary)} ₸</td>
                      <td>{fmt(p.deductions)} ₸</td>
                      <td>{fmt(p.advance_paid)} ₸</td>
                      <td>
                        {canEdit ? (
                          <input type="number" className="timesheet-money-input" style={{ width: 90 }}
                            defaultValue={p.manual_deductions || ''}
                            placeholder="0"
                            onBlur={(e) => updatePayrollField(p, { manual_deductions: Number(e.target.value) || 0 })}
                          />
                        ) : `${fmt(p.manual_deductions || 0)} ₸`}
                      </td>
                      <td>
                        {canEdit ? (
                          <input type="number" className="timesheet-money-input" style={{ width: 80 }}
                            defaultValue={p.bonuses || ''}
                            onBlur={(e) => updatePayrollField(p, { bonuses: Number(e.target.value) || 0 })}
                          />
                        ) : `${fmt(p.bonuses)} ₸`}
                      </td>
                      <td><strong>{fmt(p.final_amount)} ₸</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </>
        ) : tab === 'payroll' ? (
          <>
            <div className="timesheet-meta">
              <span>Сотрудников: <strong>{payroll.length}</strong></span>
              <span>ФОТ к выплате: <strong>{fmt(totalFot)} ₸</strong></span>
              <span className="form-hint">Данные подтягиваются из табеля автоматически</span>
            </div>
            <TableScroll>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ФИО</th><th>Должность</th><th>Подразделение</th>
                    <th>Оклад</th><th>План ч</th><th>Факт ч</th>
                    <th>Начислено</th><th>Бонусы</th><th>Аванс</th><th>Штраф</th><th>Отчисления</th><th>Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.length === 0 ? (
                    <tr><td colSpan={12} className="empty-state">Нет сотрудников в выбранном подразделении</td></tr>
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
                      <td>{fmt(p.deductions)} ₸</td>
                      <td>{fmt(p.manual_deductions || 0)} ₸</td>
                      <td><strong>{fmt(p.final_amount)} ₸</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </>
        ) : tab === 'bonuses' ? (
          <TableScroll><table className="data-table">
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
          </table></TableScroll>
        ) : (
          <>
            {canRequestAdvance && (
              <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => setShowAdvanceForm(true)}>+ Запросить аванс</button>
              </div>
            )}
            <TableScroll><table className="data-table">
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
                        onClick={() => api.approveAdvance(a.id, 'approved', a.requested_amount).then(() => load())}>
                        Одобрить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></TableScroll>
          {showAdvanceForm && (
            <div className="modal-overlay" onClick={() => setShowAdvanceForm(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2>Заявка на аванс</h2>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const emp = employees.find((x) => x.id === advanceForm.employee_id);
                  if (!emp) return;
                  try {
                    await api.createAdvance({
                      employee_id: emp.id,
                      unit_id: emp.unit_id,
                      year,
                      month,
                      requested_amount: advanceForm.requested_amount,
                    });
                    setShowAdvanceForm(false);
                    await load();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Ошибка');
                  }
                }}>
                  <div className="form-group"><label>Сотрудник</label>
                    <select value={advanceForm.employee_id} onChange={(e) => setAdvanceForm({ ...advanceForm, employee_id: e.target.value })} required>
                      <option value="">Выберите...</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Сумма (₸)</label>
                    <input type="number" value={advanceForm.requested_amount || ''} onChange={(e) => setAdvanceForm({ ...advanceForm, requested_amount: Number(e.target.value) })} required />
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#666' }}>Лимит — 50% от оклада</p>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanceForm(false)}>Отмена</button>
                    <button type="submit" className="btn btn-primary">Отправить</button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
