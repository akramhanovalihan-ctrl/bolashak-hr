import { useEffect, useState } from 'react';
import { api, type HrUser, type Unit } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ', hr: 'HR', finance: 'Финансы', manager: 'Руководитель', employee: 'Сотрудник',
};

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState<HrUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const status = filter === 'all' ? undefined : filter;
    Promise.all([api.getUsers(status), api.getUnits()])
      .then(([u, un]) => {
        setUsers(u.users);
        setUnits(un.units);
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

  if (user?.role !== 'admin' && user?.role !== 'hr') {
    return <div className="empty-state">Недостаточно прав</div>;
  }

  const pendingCount = users.filter((u) => !u.is_active && u.is_active !== 1).length;

  return (
    <div>
      <h1 className="page-title">Пользователи</h1>
      <p className="page-subtitle">Подтверждение регистраций и назначение ролей</p>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <button type="button" className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('pending')}>
              Ожидают ({filter === 'pending' ? users.length : '…'})
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
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email</th>
                <th>Роль</th>
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
          </table>
        )}
      </div>

      {filter === 'pending' && pendingCount > 0 && (
        <p className="form-hint" style={{ marginTop: 12 }}>
          После подтверждения назначьте роль и подразделение — пользователь сможет войти.
        </p>
      )}
    </div>
  );
}
