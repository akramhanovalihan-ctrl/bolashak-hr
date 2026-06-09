import { useEffect, useState } from 'react';
import { api, type Unit } from '../api/client';

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
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getUnits()
      .then(({ units }) => setUnits(units))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="page-title">Подразделения</h1>
      <p className="page-subtitle">Справочник hr_units — 11 подразделений компании</p>

      <div className="card">
        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Код</th>
                <th>Тип</th>
                <th>График</th>
                <th>Норма ч/мес</th>
                <th>Руководитель</th>
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
                  <td>{unit.manager_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
