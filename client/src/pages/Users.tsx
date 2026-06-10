import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { api, type Employee, type HrUser, type Unit } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<HrUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const status = filter === 'all' ? undefined : filter;
    Promise.all([
      api.getUsers(status),
      api.getUnits(),
      api.getEmployees({ status: 'active' }),
      api.getPositions(),
    ])
      .then(([u, un, em, pos]) => {
        setUsers(u.users);
        setUnits(un.units);
        setEmployees(em.employees);
        setPositions(pos.positions);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (u: HrUser) => {
    await api.updateUser(u.id, { is_active: true });
    load();
  };

  const updateRole = async (u: HrUser, role: string) => {
    await api.updateUser(u.id, { role });
    load();
  };

  const updateUnit = async (u: HrUser, unit_id: string) => {
    await api.updateUser(u.id, { unit_id: unit_id || null });
    load();
  };

  const linkEmployee = async (u: HrUser, employee_id: string) => {
    await api.updateUser(u.id, { employee_id: employee_id || null });
    load();
  };

  const updateJobTitle = async (u: HrUser, job_title: string) => {
    await api.updateUser(u.id, { job_title: job_title || null });
    load();
  };

  if (user?.role !== 'admin' && user?.role !== 'hr') {
    return <div className="empty-state">Недостаточно прав</div>;
  }

  return (
    <div>
      <h1 className="page-title">Пользователи</h1>
      <p className="page-subtitle">Подтверждение регистраций, доступ в систему и должность по оргструктуре</p>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <button type="button" className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('pending')}>
              Ожидают
            </button>
            <button type="button" className={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('active')}>
              Активные
            </button>
            <button type="button" className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>
              Все
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            {filter === 'pending' ? 'Нет заявок на регистрацию' : 'Пользователей нет'}
          </div>
        ) : (
          <TableScroll><table className="data-table">
            <thead>
              <tr>
                <th>Сотрудник (из базы)</th>
                <th>ФИО</th>
                <th>Email</th>
                <th>Доступ</th>
                <th>Должность</th>
                <th>Подразделение</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const active = u.is_active === 1 || u.is_active === true;
                return (
                  <tr key={u.id}>
                    <td>
                      <select
                        value={u.employee_id || ''}
                        onChange={(e) => linkEmployee(u, e.target.value)}
                        disabled={!active}
                        title="Выберите сотрудника — подтянутся ФИО, должность и подразделение"
                      >
                        <option value="">— не привязан —</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} · {emp.position}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td><strong>{u.full_name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u, e.target.value)}
                        disabled={!active}
                      >
                        {Object.entries(ROLE_LABELS)
                          .filter(([k]) => user?.role === 'admin' || k !== 'admin')
                          .map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={u.job_title || ''}
                        onChange={(e) => updateJobTitle(u, e.target.value)}
                        disabled={!active}
                      >
                        <option value="">—</option>
                        {positions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={u.unit_id || ''}
                        onChange={(e) => updateUnit(u, e.target.value)}
                        disabled={!active}
                      >
                        <option value="">—</option>
                        {units.map((un) => (
                          <option key={un.id} value={un.id}>{un.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>{active ? 'Активен' : 'Ожидает'}</td>
                    <td>
                      {!active && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(u)}>
                          Подтвердить
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></TableScroll>
        )}
      </div>

      <p className="form-hint" style={{ marginTop: 12 }}>
        Доступ — уровень в системе (админ, HR, руководитель). Должность — из оргструктуры (кассир, продавец-консультант и т.д.).
      </p>
    </div>
  );
}
