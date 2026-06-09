import { useEffect, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
export default function Shifts() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [schedule, setSchedule] = useState<any>(null);

  useEffect(() => {
    api.getUnits().then(({ units }) => {
      const shiftUnits = units.filter((u) => ['shift', 'shift_mixed'].includes(u.schedule_type));
      setUnits(shiftUnits);
      if (shiftUnits[0]) setUnitId(shiftUnits[0].id);
    });
  }, []);

  const load = () => { if (unitId) api.getShiftSchedule(unitId, year, month).then(({ schedule }) => setSchedule(schedule)); };
  useEffect(() => { load(); }, [unitId, year, month]);

  const generate = async () => {
    await api.generateShiftSchedule({ unit_id: unitId, year, month });
    load();
  };

  const data = schedule?.schedule_data || {};
  const employees = Object.entries(data);

  return (
    <div>
      <h1 className="page-title">График смен</h1>
      <p className="page-subtitle">Планирование смен (магазины, РЦ, СБ)</p>
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
            {schedule && schedule.status === 'draft' &&
              <button className="btn btn-secondary" onClick={() => api.publishShiftSchedule(schedule.id).then(load)}>Опубликовать</button>}
          </div>
        </div>
        {!schedule ? <div className="empty-state">График не создан</div> : (
          <>
            <div style={{ padding: 12, fontSize: '0.85rem' }}>Статус: <strong>{schedule.status}</strong></div>
            <table className="data-table">
              <thead><tr><th>Сотрудник</th><th>Смены (по дням)</th></tr></thead>
              <tbody>
                {employees.map(([id, emp]: any) => (
                  <tr key={id}><td>{emp.name}</td><td>{Object.values(emp.days || {}).join(' ')}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
