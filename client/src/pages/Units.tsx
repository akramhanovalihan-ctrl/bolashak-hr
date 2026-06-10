import TableScroll from '../components/TableScroll';
import { FormEvent, useEffect, useState } from 'react';
import { api, type ManagerCandidate, type Unit } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TYPE_LABELS: Record<string, string> = {
  store: 'Магазин',
  warehouse: 'Склад',
  office: 'Офис',
  security: 'Безопасность',
};

const SCHEDULE_LABELS: Record<string, string> = {
  shift: 'Сменный',
  shift_mixed: 'Смешанный',
  standard_5_2: 'Стандарт 5/2',
  flexible: 'Гибкий',
};

export default function Units() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'hr';

  const [units, setUnits] = useState<Unit[]>([]);
  const [candidates, setCandidates] = useState<ManagerCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Unit | null>(null);
  const [managerId, setManagerId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadUnits = () => {
    setLoading(true);
    Promise.all([
      api.getUnits(),
      canEdit ? api.getManagerCandidates() : Promise.resolve({ candidates: [] }),
    ])
      .then(([unitsRes, candidatesRes]) => {
        setUnits(unitsRes.units);
        setCandidates(candidatesRes.candidates);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUnits();
  }, [canEdit]);

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    setManagerId(unit.manager_user_id || '');
    setError('');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await api.updateUnit(editing.id, { manager_user_id: managerId || null });
      setEditing(null);
      loadUnits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Подразделения</h1>
      <p className="page-subtitle">Справочник подразделений с назначенным руководителем (ком. отдела)</p>

      <div className="card">
        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : (
          <TableScroll><table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Код</th>
                <th>Тип</th>
                <th>График</th>
                <th>Норма ч/мес</th>
                <th>Руководитель</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td><strong>{unit.name}</strong></td>
                  <td><code>{unit.code}</code></td>
                  <td>
                    <span className={`type-badge ${unit.unit_type}`}>
                      {TYPE_LABELS[unit.unit_type] || unit.unit_type}
                    </span>
                  </td>
                  <td>{SCHEDULE_LABELS[unit.schedule_type] || unit.schedule_type}</td>
                  <td>{unit.hours_norm_default}</td>
                  <td>{unit.manager_name || <span style={{ color: 'var(--warning)' }}>Не назначен</span>}</td>
                  {canEdit && (
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(unit)}>
                        Изменить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table></TableScroll>
        )}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Руководитель — {editing.name}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Ком. отдела / руководитель подразделения</label>
                <select value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                  <option value="">Не назначен</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.role})
                    </option>
                  ))}
                </select>
                <p className="form-hint">Ответственный за табель, график смен и согласования в этом подразделении</p>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
