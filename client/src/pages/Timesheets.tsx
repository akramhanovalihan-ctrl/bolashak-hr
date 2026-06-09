import { useEffect, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
import { useAuth } from '../context/AuthContext';

export default function Timesheets() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [timesheet, setTimesheet] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getUnits().then(({ units }) => { setUnits(units); if (user?.unit_id) setUnitId(user.unit_id); else if (units[0]) setUnitId(units[0].id); }); }, [user]);

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const { timesheets } = await api.getTimesheets({ unit_id: unitId, year, month });
      if (timesheets[0]) {
        const data = await api.getTimesheetEntries((timesheets[0] as any).id);
        setTimesheet(data.timesheet);
        setEntries(data.entries);
      } else { setTimesheet(null); setEntries([]); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [unitId, year, month]);

  const generate = async () => {
    const { timesheet: ts } = await api.generateTimesheet({ unit_id: unitId, year, month }) as any;
    const data = await api.getTimesheetEntries(ts.id);
    setTimesheet(data.timesheet); setEntries(data.entries);
  };

  const save = async () => {
    await api.saveTimesheetEntries(timesheet.id, entries);
    setError(''); alert('Сохранено');
  };

  const scheduleType = timesheet?.schedule_type_snapshot;
  const isShift = scheduleType === 'shift' || scheduleType === 'shift_mixed';
  const isFlexible = scheduleType === 'flexible';

  return (
    <div>
      <h1 className="page-title">Табель</h1>
      <p className="page-subtitle">Учёт рабочего времени по подразделениям</p>
      <div className="card">
        <div className="card-header">
          <div className="filters">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            {!timesheet && <button className="btn btn-primary" onClick={generate}>Создать табель</button>}
            {timesheet && timesheet.status === 'draft' && <>
              <button className="btn btn-secondary" onClick={save}>Сохранить</button>
              <button className="btn btn-primary" onClick={() => api.submitTimesheet(timesheet.id).then(load)}>Сдать</button>
            </>}
            {timesheet && timesheet.status === 'submitted' && (user?.role === 'admin' || user?.role === 'hr') &&
              <button className="btn btn-primary" onClick={() => api.approveTimesheet(timesheet.id).then(load)}>Утвердить</button>}
          </div>
        </div>
        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}
        {loading ? <div className="empty-state">Загрузка...</div> : !timesheet ? (
          <div className="empty-state">Табель за период не создан. Нажмите «Создать табель».</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Статус: <strong>{timesheet.status}</strong> · Режим: {timesheet.schedule_type_snapshot}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr><th>Сотрудник</th>{isShift && <th>Дни (коды)</th>}{isFlexible && <th>Часы за месяц</th>}<th>Итого ч</th><th>Норма</th></tr></thead>
                <tbody>
                  {entries.map((ent, idx) => (
                    <tr key={ent.id}>
                      <td><strong>{ent.full_name}</strong><br /><small>{ent.position}</small></td>
                      {isShift && (
                        <td>
                          <input style={{ width: 280 }} value={Object.values(ent.shift_data || {}).filter((v) => typeof v === 'string' && v.length === 1).join('')}
                            onChange={(e) => {
                              const copy = [...entries];
                              const days: Record<string, string> = {};
                              e.target.value.split('').forEach((c, i) => { days[String(i + 1).padStart(2, '0')] = c; });
                              copy[idx] = { ...ent, shift_data: days };
                              setEntries(copy);
                            }}
                            placeholder="ДДВВНН..." disabled={timesheet.status !== 'draft'} />
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>Д · В · Н · О · Б</small>
                        </td>
                      )}
                      {isFlexible && (
                        <td>
                          <input type="number" value={ent.shift_data?.total_hours ?? ent.hours_worked}
                            onChange={(e) => {
                              const copy = [...entries];
                              copy[idx] = { ...ent, shift_data: { total_hours: Number(e.target.value) } };
                              setEntries(copy);
                            }} disabled={timesheet.status !== 'draft'} />
                        </td>
                      )}
                      <td>{ent.hours_worked}</td>
                      <td>{ent.hours_norm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
