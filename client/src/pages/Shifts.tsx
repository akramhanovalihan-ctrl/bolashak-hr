import TableScroll from '../components/TableScroll';
import { useEffect, useMemo, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';

const SHIFT_CODES = ['Д', 'Н', 'В', 'О', 'Б', ''];

export default function Shifts() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [schedule, setSchedule] = useState<any>(null);
  const [editedData, setEditedData] = useState<Record<string, { name: string; days: Record<string, string> }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUnits().then(({ units }) => {
      const shiftUnits = units.filter((u) => ['shift', 'shift_mixed'].includes(u.schedule_type));
      setUnits(shiftUnits);
      if (shiftUnits[0]) setUnitId(shiftUnits[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const dayCols = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')),
    [daysInMonth]
  );

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    setError('');
    try {
      const { schedule: s } = await api.getShiftSchedule(unitId, year, month);
      setSchedule(s);
      const schedData = (s as { schedule_data?: Record<string, { name: string; days: Record<string, string> }> } | null)?.schedule_data;
      if (schedData) {
        setEditedData(JSON.parse(JSON.stringify(schedData)));
      } else {
        setEditedData({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [unitId, year, month]);

  const generate = async () => {
    try {
      await api.generateShiftSchedule({ unit_id: unitId, year, month });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const updateCell = (empId: string, day: string, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        days: { ...prev[empId]?.days, [day]: value },
      },
    }));
  };

  const save = async () => {
    if (!schedule?.id) return;
    setSaving(true);
    try {
      await api.saveShiftSchedule(schedule.id, editedData);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const employees = Object.entries(editedData);
  const canEdit = schedule?.status === 'draft';

  return (
    <div>
      <h1 className="page-title">График смен</h1>
      <p className="page-subtitle">Планирование смен (магазины, РЦ, СБ). Д — день, Н — ночь, В — выходной</p>
      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="card">
        <div className="card-header">
          <div className="filters">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            <button className="btn btn-primary" onClick={generate}>{schedule ? 'Обновить' : 'Создать'} график</button>
            {canEdit && schedule && (
              <button className="btn btn-secondary" onClick={save} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}
            {schedule && schedule.status === 'draft' &&
              <button className="btn btn-secondary" onClick={() => api.publishShiftSchedule(schedule.id).then(load)}>Опубликовать</button>}
          </div>
        </div>
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : !schedule ? (
          <div className="empty-state">График не создан</div>
        ) : (
          <>
            <div style={{ padding: 12, fontSize: '0.85rem' }}>Статус: <strong>{schedule.status === 'published' ? 'Опубликован' : 'Черновик'}</strong></div>
            <TableScroll><table className="data-table timesheet-grid">
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  {dayCols.map((d) => <th key={d} style={{ minWidth: 36, textAlign: 'center' }}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {employees.map(([id, emp]) => (
                  <tr key={id}>
                    <td>{emp.name}</td>
                    {dayCols.map((d) => (
                      <td key={d} style={{ padding: 2, textAlign: 'center' }}>
                        {canEdit ? (
                          <select
                            value={emp.days?.[d] || ''}
                            onChange={(e) => updateCell(id, d, e.target.value)}
                            style={{ width: 40, fontSize: '0.75rem', padding: 2 }}
                          >
                            {SHIFT_CODES.map((c) => <option key={c} value={c}>{c || '—'}</option>)}
                          </select>
                        ) : (
                          emp.days?.[d] || '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></TableScroll>
          </>
        )}
      </div>
    </div>
  );
}
