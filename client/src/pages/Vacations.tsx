import TableScroll from '../components/TableScroll';
import EmployeeSelect from '../components/EmployeeSelect';
import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { calcCalendarDays } from '../utils/workingDays';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  manager_ok: 'Согласовано руководителем',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

export default function Vacations() {
  const { user } = useAuth();
  const [vacations, setVacations] = useState<any[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ employee_id: '', unit_id: '', type: 'AL', date_from: '', date_to: '', days_count: 1, reason: '' });
  const [daysAuto, setDaysAuto] = useState(true);

  const isEmployee = user?.role === 'employee';
  const canManagerAct = user?.role === 'manager';
  const canHrAct = user?.role === 'admin' || user?.role === 'hr';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { vacations, types } = await api.getVacations();
      setVacations(vacations);
      setTypes(types);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (!isEmployee) {
      api.getEmployees({ status: 'active' }).then(({ employees }) => setEmployees(employees)).catch(() => {});
    }
  }, [isEmployee]);

  useEffect(() => {
    if (!form.date_from || !form.date_to || !daysAuto) return;
    const days = calcCalendarDays(form.date_from, form.date_to);
    if (days > 0) setForm((f) => ({ ...f, days_count: days }));
  }, [form.date_from, form.date_to, daysAuto]);

  const openForm = () => {
    setForm({ employee_id: '', unit_id: '', type: 'AL', date_from: '', date_to: '', days_count: 1, reason: '' });
    setDaysAuto(true);
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEmployee) {
        await api.createVacation({
          type: form.type,
          date_from: form.date_from,
          date_to: form.date_to,
          days_count: form.days_count,
          reason: form.reason,
        });
      } else {
        const emp = employees.find((x) => x.id === form.employee_id);
        await api.createVacation({ ...form, unit_id: emp?.unit_id });
      }
      setShowForm(false);
      setForm({ employee_id: '', unit_id: '', type: 'AL', date_from: '', date_to: '', days_count: 1, reason: '' });
      setDaysAuto(true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  };

  const canActOn = (v: any) => {
    if (v.status === 'pending' && canManagerAct) return true;
    if (['pending', 'manager_ok'].includes(v.status) && canHrAct) return true;
    return false;
  };

  return (
    <div>
      <h1 className="page-title">Отпуска и больничные</h1>
      <p className="page-subtitle">Заявки и согласование</p>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="card">
        <div className="card-header">
          <span>{vacations.length} заявок</span>
          <button className="btn btn-primary" onClick={openForm}>+ Заявка</button>
        </div>
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : (
          <TableScroll><table className="data-table">
            <thead><tr><th>Сотрудник</th><th>Тип</th><th>Период</th><th>Дней</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {vacations.length === 0 ? (
                <tr><td colSpan={6} className="empty-state">Заявок нет</td></tr>
              ) : vacations.map((v: any) => (
                <tr key={v.id}>
                  <td>{v.full_name}</td>
                  <td>{types[v.type] || v.type}</td>
                  <td>{v.date_from} — {v.date_to}</td>
                  <td>{v.days_count}</td>
                  <td>{STATUS_LABELS[v.status] || v.status}</td>
                  <td>{canActOn(v) && <>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: 4 }}
                      onClick={() => api.approveVacation(v.id).then(load).catch((e) => setError(e.message))}>
                      {v.status === 'pending' && canManagerAct ? 'Согласовать' : 'Одобрить'}
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => api.rejectVacation(v.id).then(load).catch((e) => setError(e.message))}>Отклонить</button>
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table></TableScroll>
        )}
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новая заявка</h2>
            <form onSubmit={submit}>
              {!isEmployee && (
                <div className="form-group"><label>Сотрудник</label>
                  <EmployeeSelect
                    employees={employees}
                    value={form.employee_id}
                    onChange={(id) => setForm({ ...form, employee_id: id })}
                    required
                  />
                </div>
              )}
              <div className="form-group"><label>Тип</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>С</label><input type="date" value={form.date_from} onChange={(e) => { setDaysAuto(true); setForm({ ...form, date_from: e.target.value }); }} required /></div>
                <div className="form-group"><label>По</label><input type="date" value={form.date_to} onChange={(e) => { setDaysAuto(true); setForm({ ...form, date_to: e.target.value }); }} required /></div>
              </div>
              <div className="form-group">
                <label>Дней {daysAuto && form.date_from && form.date_to ? '(авто)' : ''}</label>
                <input
                  type="number"
                  min={1}
                  value={form.days_count}
                  onChange={(e) => {
                    setDaysAuto(false);
                    setForm({ ...form, days_count: Number(e.target.value) });
                  }}
                />
              </div>
              <div className="form-group"><label>Причина</label><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Подать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
