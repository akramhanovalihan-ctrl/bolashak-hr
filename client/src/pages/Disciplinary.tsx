import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Disciplinary() {
  const { user } = useAuth();
  const [violations, setViolations] = useState<any[]>([]);
  const [types, setTypes] = useState<Record<string, { label: string; amount: number }>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employee_id: '', unit_id: '', violation_type: 'LATE_S', violation_date: new Date().toISOString().slice(0, 10), description: '' });

  useEffect(() => {
    api.getViolations().then(({ violations }) => setViolations(violations));
    api.getViolationTypes().then(({ types }) => setTypes(types));
    api.getEmployees().then(({ employees }) => setEmployees(employees));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((x) => x.id === form.employee_id);
    await api.createViolation({ ...form, unit_id: emp?.unit_id });
    setShowForm(false);
    api.getViolations().then(({ violations }) => setViolations(violations));
  };

  return (
    <div>
      <h1 className="page-title">Дисциплина</h1>
      <p className="page-subtitle">Штрафы и нарушения</p>
      <div className="card">
        <div className="card-header">
          <span>Журнал нарушений</span>
          {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') &&
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Зафиксировать</button>}
        </div>
        <table className="data-table">
          <thead><tr><th>Дата</th><th>Сотрудник</th><th>Тип</th><th>Сумма</th><th>Подразделение</th></tr></thead>
          <tbody>
            {violations.map((v: any) => (
              <tr key={v.id}>
                <td>{v.violation_date}</td><td>{v.full_name}</td>
                <td>{types[v.violation_type]?.label || v.violation_type}</td>
                <td>{Number(v.deduction_amount).toLocaleString('ru-RU')} ₸</td>
                <td>{v.unit_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новое нарушение</h2>
            <form onSubmit={submit}>
              <div className="form-group"><label>Сотрудник</label>
                <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required>
                  <option value="">...</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Тип</label>
                <select value={form.violation_type} onChange={(e) => setForm({ ...form, violation_type: e.target.value })}>
                  {Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.amount} ₸)</option>)}
                </select>
              </div>
              <div className="form-group"><label>Дата</label>
                <input type="date" value={form.violation_date} onChange={(e) => setForm({ ...form, violation_date: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
