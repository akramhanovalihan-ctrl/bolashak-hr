import { useEffect, useMemo, useState } from 'react';
import { api, type Unit } from '../api/client';
import PeriodSelect from '../components/PeriodSelect';
import { useAuth } from '../context/AuthContext';

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

const ABSENCE_CODES = new Set(['О', 'Б', 'У', 'Н', 'В', 'Отп', 'ОТП', 'отп']);
const INTERN_CODES = new Set(['Ст', 'СТ', 'ст']);
const LEGACY_WORK = { Д: 8, Н: 8, Р: 8 } as Record<string, number>;

const LEGEND = [
  { code: '8, 4, 7.5', label: 'Часы', hint: 'Фактическое количество часов. Не округлять!' },
  { code: 'О', label: 'Отгул' },
  { code: 'Б', label: 'Больничный' },
  { code: 'У', label: 'Увольнение' },
  { code: 'Н', label: 'Неявка' },
  { code: 'В', label: 'Выходной' },
  { code: 'Отп', label: 'Отпуск' },
  { code: 'Ст', label: 'Стажёр', hint: 'Не входит в итог часов' },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function dayKey(day: number) {
  return String(day).padStart(2, '0');
}

function parseDayValue(value: unknown) {
  if (value === undefined || value === null || value === '') return { hours: 0, type: 'empty' as const };
  const s = String(value).trim();
  if (INTERN_CODES.has(s)) return { hours: 0, type: 'intern' as const };
  if (ABSENCE_CODES.has(s)) return { hours: 0, type: 'absence' as const, code: s };
  if (LEGACY_WORK[s]) return { hours: LEGACY_WORK[s], type: 'legacy' as const };
  const num = Number(s.replace(',', '.'));
  if (!Number.isNaN(num) && num >= 0) return { hours: num, type: 'hours' as const };
  return { hours: 0, type: 'unknown' as const };
}

function calcHours(shiftData: Record<string, unknown>) {
  let total = 0;
  for (const [key, value] of Object.entries(shiftData)) {
    if (!/^\d{2}$/.test(key)) continue;
    const parsed = parseDayValue(value);
    if (parsed.type === 'intern') continue;
    total += parsed.hours;
  }
  return Math.round(total * 100) / 100;
}

function cellClass(value: unknown) {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (INTERN_CODES.has(s)) return 'timesheet-cell-intern';
  if (ABSENCE_CODES.has(s)) return 'timesheet-cell-absence';
  if (!Number.isNaN(Number(s.replace(',', '.')))) return 'timesheet-cell-hours';
  return 'timesheet-cell-code';
}

type TimesheetEntry = {
  id: string;
  employee_id: string;
  full_name: string;
  position: string;
  hours_worked: number;
  hours_norm: number;
  fine_amount: number;
  advance_amount: number;
  shift_data: Record<string, unknown>;
  row_num?: number;
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  submitted: 'Сдан',
  rejected: 'Отклонён',
  approved: 'Утверждён',
};

export default function Timesheets() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
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
      const list = isManager && user?.unit_id ? u.filter((x) => x.id === user.unit_id) : u;
      setUnits(list);
      if (user?.unit_id) setUnitId(user.unit_id);
      else if (list[0]) setUnitId(list[0].id);
    });
  }, [user, isManager]);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const unitName = units.find((u) => u.id === unitId)?.name || String(timesheet?.unit_name || '');

  const dayColumns = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    const dow = date.getDay();
    return { day, key: dayKey(day), weekday: WEEKDAYS[dow], isWeekend: dow === 0 || dow === 6 };
  }), [year, month, daysInMonth]);

  const isEditable = timesheet?.status === 'draft' || timesheet?.status === 'rejected';

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
      const normalized = (data.entries as TimesheetEntry[]).map((ent, idx) => {
        const raw = (typeof ent.shift_data === 'string' ? JSON.parse(ent.shift_data) : ent.shift_data) || {};
        const shift_data = { ...raw };
        for (let d = 1; d <= daysInMonth; d++) {
          const k = dayKey(d);
          if (shift_data[k] === undefined || shift_data[k] === null) shift_data[k] = '';
        }
        return {
          ...ent,
          row_num: ent.row_num ?? idx + 1,
          fine_amount: Number(ent.fine_amount) || 0,
          advance_amount: Number(ent.advance_amount) || 0,
          shift_data,
          hours_worked: calcHours(shift_data),
        };
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

  const updateCell = (idx: number, key: string, value: string) => {
    const copy = [...entries];
    const ent = { ...copy[idx] };
    ent.shift_data = { ...ent.shift_data, [key]: value };
    ent.hours_worked = calcHours(ent.shift_data);
    copy[idx] = ent;
    setEntries(copy);
  };

  const updateField = (idx: number, field: 'full_name' | 'position' | 'fine_amount' | 'advance_amount', value: string | number) => {
    const copy = [...entries];
    copy[idx] = { ...copy[idx], [field]: value };
    setEntries(copy);
  };

  const addRow = async () => {
    if (!timesheet) return;
    const full_name = window.prompt('ФИО нового сотрудника');
    if (!full_name?.trim()) return;
    const position = window.prompt('Должность', 'Сотрудник') || 'Сотрудник';
    try {
      await api.addTimesheetRow(String(timesheet.id), { full_name: full_name.trim(), position });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить строку');
    }
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

  const managerName = String(timesheet?.manager_name || '');
  const hrApprover = String(timesheet?.hr_approver_name || 'HR-отдел');
  const planHours = Number(timesheet?.hours_norm_planned) || entries[0]?.hours_norm || 0;

  return (
    <div>
      <h1 className="page-title">Табель учёта рабочего времени</h1>
      <p className="page-subtitle">
        {unitName} — {MONTHS_FULL[month - 1]} {year}
        {managerName ? ` · Руководитель: ${managerName}` : ''}
        {` · Утверждает: ${hrApprover}`}
      </p>

      <div className="card timesheet-card">
        <div className="card-header">
          <div className="filters">
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={isManager}
              title={isManager ? 'Руководитель видит только своё подразделение' : undefined}
            >
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <PeriodSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          </div>
          <div className="filters">
            {timesheet && isEditable && (
              <>
                <button type="button" className="btn btn-secondary" onClick={addRow}>+ Строка</button>
                <button type="button" className="btn btn-secondary" onClick={save} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => api.submitTimesheet(String(timesheet.id)).then(load)}>
                  Сдать табель
                </button>
              </>
            )}
            {timesheet && timesheet.status === 'submitted' && user?.role === 'hr' && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => api.approveTimesheet(String(timesheet.id)).then(load)}>
                  Утвердить (HR)
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  const reason = prompt('Причина отклонения (необязательно)') || '';
                  api.rejectTimesheet(String(timesheet.id), reason).then(load);
                }}>
                  Отклонить
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}

        {loading ? (
          <div className="empty-state">Загрузка табеля...</div>
        ) : !timesheet ? (
          <div className="empty-state">Нет данных за выбранный период</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            В подразделении нет сотрудников.
            {isEditable && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={addRow}>
                Добавить первую строку
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="timesheet-meta">
              <span>Статус: <strong>{STATUS_LABELS[String(timesheet.status)] || String(timesheet.status)}</strong></span>
              <span>Сотрудников: <strong>{entries.length}</strong></span>
              <span>Плановые часы: <strong>{planHours}</strong></span>
              <span>Итого факт: <strong>{entries.reduce((s, e) => s + e.hours_worked, 0).toFixed(1)}</strong></span>
            </div>

            <div className="timesheet-legend-bar">
              {LEGEND.map((item) => (
                <span key={item.code} className="timesheet-legend-item" title={item.hint || item.label}>
                  <strong>{item.code}</strong> — {item.label}
                </span>
              ))}
            </div>

            <div className="timesheet-scroll">
              <table className="timesheet-grid timesheet-bolashak">
                <thead>
                  <tr className="timesheet-header-row">
                    <th className="timesheet-sticky-col timesheet-num-col">№</th>
                    <th className="timesheet-sticky-col timesheet-name-col">ФИО</th>
                    <th className="timesheet-sticky-col timesheet-pos-col">Должность</th>
                    {dayColumns.map((col) => (
                      <th key={col.key} className={col.isWeekend ? 'timesheet-weekend' : ''}>
                        <span className="timesheet-day-num">{col.day}</span>
                        <span className="timesheet-day-dow">{col.weekday}</span>
                      </th>
                    ))}
                    <th className="timesheet-total-col">План ч</th>
                    <th className="timesheet-total-col">Итого ч</th>
                    <th className="timesheet-total-col">Штраф</th>
                    <th className="timesheet-total-col">Аванс</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((ent, idx) => (
                    <tr key={ent.id}>
                      <td className="timesheet-sticky-col timesheet-num-col">{idx + 1}</td>
                      <td className="timesheet-sticky-col timesheet-name-col">
                        {isEditable ? (
                          <input
                            className="timesheet-text-input"
                            value={ent.full_name}
                            onChange={(e) => updateField(idx, 'full_name', e.target.value)}
                          />
                        ) : (
                          <strong>{ent.full_name}</strong>
                        )}
                      </td>
                      <td className="timesheet-sticky-col timesheet-pos-col">
                        {isEditable ? (
                          <input
                            className="timesheet-text-input"
                            value={ent.position}
                            onChange={(e) => updateField(idx, 'position', e.target.value)}
                          />
                        ) : (
                          <span>{ent.position}</span>
                        )}
                      </td>
                      {dayColumns.map((col) => {
                        const val = String(ent.shift_data[col.key] ?? '');
                        return (
                          <td key={col.key} className={`${col.isWeekend ? 'timesheet-weekend' : ''} ${cellClass(val)}`}>
                            <input
                              className="timesheet-cell-input"
                              value={val}
                              onChange={(e) => updateCell(idx, col.key, e.target.value)}
                              disabled={!isEditable}
                              placeholder=""
                              title={val || 'часы или код'}
                            />
                          </td>
                        );
                      })}
                      <td className="timesheet-total-col">{ent.hours_norm || planHours}</td>
                      <td className="timesheet-total-col"><strong>{ent.hours_worked}</strong></td>
                      <td className="timesheet-total-col">
                        {isEditable ? (
                          <input
                            type="number"
                            className="timesheet-money-input"
                            min={0}
                            value={ent.fine_amount || ''}
                            onChange={(e) => updateField(idx, 'fine_amount', Number(e.target.value) || 0)}
                          />
                        ) : (
                          ent.fine_amount || '—'
                        )}
                      </td>
                      <td className="timesheet-total-col">
                        {isEditable ? (
                          <input
                            type="number"
                            className="timesheet-money-input"
                            min={0}
                            value={ent.advance_amount || ''}
                            onChange={(e) => updateField(idx, 'advance_amount', Number(e.target.value) || 0)}
                          />
                        ) : (
                          ent.advance_amount || '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="timesheet-hint">
              Заполняйте каждый день: фактические часы (8, 4, 7.5) или код из легенды. Стажёр (Ст) не входит в итог.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
