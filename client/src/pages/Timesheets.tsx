import { useEffect, useMemo, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
import { useAuth } from '../context/AuthContext';

const SHIFT_CODES = ['', 'Д', 'В', 'Н', 'О', 'Б', 'Р'] as const;
const CODE_LABELS: Record<string, string> = {
  '': '—', 'Д': 'День', 'В': 'Выходной', 'Н': 'Ночь', 'О': 'Отпуск', 'Б': 'Больничный', 'Р': 'Праздник',
};
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function dayKey(day: number) {
  return String(day).padStart(2, '0');
}

function calcHours(shiftData: Record<string, unknown>, scheduleType: string) {
  const codeHours: Record<string, number> = { 'Д': 8, 'В': 8, 'Н': 8, 'Р': 8 };
  if (scheduleType === 'flexible') {
    return Object.entries(shiftData)
      .filter(([k]) => /^\d{2}$/.test(k))
      .reduce((s, [, v]) => s + (Number(v) || 0), 0);
  }
  return Object.entries(shiftData)
    .filter(([k]) => /^\d{2}$/.test(k))
    .reduce((s, [, code]) => s + (codeHours[String(code)] || 0), 0);
}

function normalizeShiftData(
  shiftData: Record<string, unknown>,
  year: number,
  month: number,
  scheduleType: string
) {
  const days = getDaysInMonth(year, month);
  const data = { ...shiftData };
  for (let d = 1; d <= days; d++) {
    const key = dayKey(d);
    if (data[key] === undefined || data[key] === null) {
      if (scheduleType === 'flexible') data[key] = 0;
      else {
        const dow = new Date(year, month - 1, d).getDay();
        data[key] = scheduleType === 'standard_5_2'
          ? (dow === 0 || dow === 6 ? 'В' : 'Д')
          : (dow === 0 ? 'В' : 'Д');
      }
    }
  }
  return data;
}

type TimesheetEntry = {
  id: string;
  employee_id: string;
  full_name: string;
  position: string;
  hours_worked: number;
  hours_norm: number;
  shift_data: Record<string, unknown>;
};

export default function Timesheets() {
  const { user } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState('');
  const [timesheet, setTimesheet] = useState<Record<string, unknown> | null>(null);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getUnits().then(({ units: u }) => {
      setUnits(u);
      if (user?.unit_id) setUnitId(user.unit_id);
      else if (u[0]) setUnitId(u[0].id);
    });
  }, [user]);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const dayColumns = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    return { day, key: dayKey(day), weekday: WEEKDAYS[dow], isWeekend: dow === 0 || dow === 6 };
  }), [year, month, daysInMonth]);

  const scheduleType = String(timesheet?.schedule_type_snapshot || '');
  const isFlexible = scheduleType === 'flexible';
  const isEditable = timesheet?.status === 'draft';

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    setError('');
    try {
      await api.generateTimesheet({ unit_id: unitId, year, month });
      const { timesheets } = await api.getTimesheets({ unit_id: unitId, year, month });
      if (!timesheets[0]) {
        setTimesheet(null);
        setEntries([]);
        return;
      }
      const data = await api.getTimesheetEntries((timesheets[0] as { id: string }).id);
      const ts = data.timesheet as Record<string, unknown>;
      const sched = String(ts.schedule_type_snapshot);
      const normalized = (data.entries as TimesheetEntry[]).map((ent) => {
        const shift_data = normalizeShiftData(
          (typeof ent.shift_data === 'string' ? JSON.parse(ent.shift_data) : ent.shift_data) || {},
          Number(ts.year), Number(ts.month), sched
        );
        return { ...ent, shift_data, hours_worked: calcHours(shift_data, sched) };
      });
      setTimesheet(ts);
      setEntries(normalized);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [unitId, year, month]);

  const updateCell = (idx: number, key: string, value: string | number) => {
    const copy = [...entries];
    const ent = { ...copy[idx] };
    ent.shift_data = { ...ent.shift_data, [key]: value };
    ent.hours_worked = calcHours(ent.shift_data, scheduleType);
    copy[idx] = ent;
    setEntries(copy);
  };

  const save = async () => {
    if (!timesheet) return;
    setSaving(true);
    try {
      await api.saveTimesheetEntries(String(timesheet.id), entries);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Табель</h1>
      <p className="page-subtitle">
        {MONTHS_FULL[month - 1]} {year} — учёт по дням месяца для всех сотрудников подразделения
      </p>

      <div className="card">
        <div className="card-header">
          <div className="filters">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            {timesheet && isEditable && (
              <>
                <button className="btn btn-secondary" onClick={save} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button className="btn btn-primary" onClick={() => api.submitTimesheet(String(timesheet.id)).then(load)}>
                  Сдать
                </button>
              </>
            )}
            {timesheet && timesheet.status === 'submitted' && (user?.role === 'admin' || user?.role === 'hr') && (
              <button className="btn btn-primary" onClick={() => api.approveTimesheet(String(timesheet.id)).then(load)}>
                Утвердить
              </button>
            )}
          </div>
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Загрузка табеля...</div>
        ) : !timesheet ? (
          <div className="empty-state">Нет данных за выбранный период</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">В подразделении нет активных сотрудников</div>
        ) : (
          <>
            <div className="timesheet-meta">
              <span>Статус: <strong>{String(timesheet.status)}</strong></span>
              <span>График: <strong>{scheduleType}</strong></span>
              <span>Сотрудников: <strong>{entries.length}</strong></span>
              {!isFlexible && (
                <span className="timesheet-legend">
                  {Object.entries(CODE_LABELS).filter(([k]) => k).map(([k, v]) => (
                    <abbr key={k} title={v}>{k}</abbr>
                  ))}
                </span>
              )}
            </div>

            <div className="timesheet-scroll">
              <table className="timesheet-grid">
                <thead>
                  <tr>
                    <th className="timesheet-sticky-col">Сотрудник</th>
                    {dayColumns.map((col) => (
                      <th key={col.key} className={col.isWeekend ? 'timesheet-weekend' : ''}>
                        <span className="timesheet-day-num">{col.day}</span>
                        <span className="timesheet-day-dow">{col.weekday}</span>
                      </th>
                    ))}
                    <th className="timesheet-total-col">Итого ч</th>
                    <th className="timesheet-total-col">Норма</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((ent, idx) => (
                    <tr key={ent.id}>
                      <td className="timesheet-sticky-col">
                        <strong>{ent.full_name}</strong>
                        <small>{ent.position}</small>
                      </td>
                      {dayColumns.map((col) => (
                        <td key={col.key} className={col.isWeekend ? 'timesheet-weekend' : ''}>
                          {isFlexible ? (
                            <input
                              type="number"
                              className="timesheet-hour-input"
                              min={0}
                              max={24}
                              step={0.5}
                              value={Number(ent.shift_data[col.key] ?? 0)}
                              onChange={(e) => updateCell(idx, col.key, Number(e.target.value))}
                              disabled={!isEditable}
                            />
                          ) : (
                            <select
                              className="timesheet-code-select"
                              value={String(ent.shift_data[col.key] ?? '')}
                              onChange={(e) => updateCell(idx, col.key, e.target.value)}
                              disabled={!isEditable}
                              title={CODE_LABELS[String(ent.shift_data[col.key] ?? '')] || '—'}
                            >
                              {SHIFT_CODES.map((c) => (
                                <option key={c || 'empty'} value={c}>{c || '·'}</option>
                              ))}
                            </select>
                          )}
                        </td>
                      ))}
                      <td className="timesheet-total-col"><strong>{ent.hours_worked}</strong></td>
                      <td className="timesheet-total-col">{ent.hours_norm}</td>
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
