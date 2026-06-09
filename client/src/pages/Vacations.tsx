import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Vacations() {
  const { user } = useAuth();
  const [vacations, setVacations] = useState<any[]>([]);
  const [types, setTypes] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ employee_id: '', unit_id: '', type: 'AL', date_from: '', date_to: '', days_count: 1, reason: '' });

  const load = () => api.getVacations().then(({ vacations, types }) => { setVacations(vacations); setTypes(types); });
  useEffect(() => { load(); api.getEmployees().then(({ employees }) => setEmployees(employees)); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === form.employee_id);
    await api.createVacation({ ...form, unit_id: emp?.unit_id });
    setShowForm(false); load();
  };

  const canApprove = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  return (
    <div>
      <h1 className="page-title">Отпуска и больничные</h1>
      <p className="page-subtitle">Заявки и согласование</p>
      <div className="card">
        <div className="card-header">
          <span>{vacations.length} заявок</span>
          {canApprove && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Заявка</button>}
        </div>
        <table className="data-table">
          <thead><tr><th>Сотрудник</th><th>Тип</th><th>Период</th><th>Дней</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {vacations.map((v: any) => (
              <tr key={v.id}>
                <td>{v.full_name}</td><td>{types[v.type] || v.type}</td>
                <td>{v.date_from} — {v.date_to}</td><td>{v.days_count}</td><td>{v.status}</td>
                <td>{canApprove && v.status === 'pending' && <>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: 4 }}
                    onClick={() => api.approveVacation(v.id).then(load)}>Согласовать</button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => api.rejectVacation(v.id).then(load)}>Отклонить</button>
                </>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новая заявка</h2>
            <form onSubmit={submit}>
              <div className="form-group"><label>Сотрудник</label>
                <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                  <option value="">Выберите...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Тип</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>С</label><input type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} required /></div>
                <div className="form-group"><label>По</label><input type="date" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} required /></div>
              </div>
              <div className="form-group"><label>Дней</label><input type="number" value={form.days_count} onChange={(e) => setForm({ ...form, days_count: Number(e.target.value) })} /></div>
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
