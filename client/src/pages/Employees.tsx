import { FormEvent, useEffect, useState } from 'react';
import { api, type Employee, type Unit } from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPLOYMENT_LABELS: Record<string, string> = {
  full: 'Полная ставка',
  part: 'Неполная',
  hourly: 'Почасовая',
  contractor: 'ГПХ',
};

export default function Employees() {
  const { user } = useAuth();
  const canCreate = user?.role === 'admin' || user?.role === 'hr';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    unit_id: '',
    position: '',
    employment_type: 'full',
    salary: '',
    hire_date: new Date().toISOString().slice(0, 10),
    phone: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, unitsRes] = await Promise.all([
        api.getEmployees({ unit_id: unitFilter || undefined, search: search || undefined }),
        api.getUnits(),
      ]);
      setEmployees(empRes.employees);
      setUnits(unitsRes.units);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [unitFilter]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createEmployee({
        full_name: form.full_name,
        unit_id: form.unit_id,
        position: form.position,
        employment_type: form.employment_type,
        salary: form.salary ? Number(form.salary) : undefined,
        hire_date: form.hire_date,
        phone: form.phone || undefined,
      });
      setShowModal(false);
      setForm({
        full_name: '',
        unit_id: '',
        position: '',
        employment_type: 'full',
        salary: '',
        hire_date: new Date().toISOString().slice(0, 10),
        phone: '',
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">База сотрудников</h1>
      <p className="page-subtitle">Единый реестр персонала всех подразделений</p>

      <div className="card">
        <div className="card-header">
          <form className="filters" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Поиск по ФИО..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Все подразделения</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-secondary">Найти</button>
          </form>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Добавить сотрудника
            </button>
          )}
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            Сотрудников пока нет. {canCreate && 'Добавьте первого сотрудника.'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Должность</th>
                <th>Подразделение</th>
                <th>Тип занятости</th>
                <th>Оклад</th>
                <th>Дата приёма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td><strong>{emp.full_name}</strong></td>
                  <td>{emp.position}</td>
                  <td>{emp.unit_name}</td>
                  <td>{EMPLOYMENT_LABELS[emp.employment_type] || emp.employment_type}</td>
                  <td>{emp.salary ? `${Number(emp.salary).toLocaleString('ru-RU')} ₸` : '—'}</td>
                  <td>{new Date(emp.hire_date).toLocaleDateString('ru-RU')}</td>
                  <td>{emp.status === 'active' ? 'Активен' : emp.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый сотрудник</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>ФИО *</label>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Подразделение *</label>
                  <select
                    value={form.unit_id}
                    onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                    required
                  >
                    <option value="">Выберите...</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Должность *</label>
                  <input
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип занятости</label>
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                  >
                    <option value="full">Полная ставка</option>
                    <option value="part">Неполная</option>
                    <option value="hourly">Почасовая</option>
                    <option value="contractor">ГПХ</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Оклад (₸)</label>
                  <input
                    type="number"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата приёма *</label>
                  <input
                    type="date"
                    value={form.hire_date}
                    onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Телефон</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
