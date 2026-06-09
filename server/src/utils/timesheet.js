/** Логика табеля Болашак — по инструкции из Google Sheets */

const ABSENCE_CODES = new Set(['О', 'Б', 'У', 'Н', 'В', 'Отп', 'ОТП', 'отп']);
const INTERN_CODES = new Set(['Ст', 'СТ', 'ст']);
const LEGACY_WORK_CODES = { 'Д': 8, 'Н': 8, 'Р': 8 };

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function dayKey(day) {
  return String(day).padStart(2, '0');
}

export function parseDayValue(value) {
  if (value === undefined || value === null || value === '') {
    return { hours: 0, type: 'empty' };
  }
  const s = String(value).trim();
  if (INTERN_CODES.has(s)) return { hours: 0, type: 'intern' };
  if (ABSENCE_CODES.has(s)) return { hours: 0, type: 'absence', code: s };
  if (LEGACY_WORK_CODES[s]) return { hours: LEGACY_WORK_CODES[s], type: 'legacy' };

  const num = Number(s.replace(',', '.'));
  if (!Number.isNaN(num) && num >= 0) return { hours: num, type: 'hours' };
  return { hours: 0, type: 'unknown' };
}

export function buildDefaultShiftData(year, month) {
  const days = getDaysInMonth(year, month);
  const shiftData = { mode: 'hours_daily' };
  for (let d = 1; d <= days; d++) shiftData[dayKey(d)] = '';
  return shiftData;
}

export function calcHoursFromShiftData(shiftData, _scheduleType) {
  if (!shiftData || typeof shiftData !== 'object') return 0;
  let total = 0;

  for (const [key, value] of Object.entries(shiftData)) {
    if (!/^\d{2}$/.test(key)) continue;
    const parsed = parseDayValue(value);
    if (parsed.type === 'intern') continue;
    total += parsed.hours;
  }

  if (total > 0) return Math.round(total * 100) / 100;
  if (shiftData.total_hours != null) return Number(shiftData.total_hours) || 0;
  return 0;
}

export const TIMESHEET_LEGEND = [
  { code: '8, 4, 7.5', label: 'Часы', hint: 'Фактическое количество часов. Не округлять!' },
  { code: 'О', label: 'Отгул' },
  { code: 'Б', label: 'Больничный' },
  { code: 'У', label: 'Увольнение' },
  { code: 'Н', label: 'Неявка' },
  { code: 'В', label: 'Выходной' },
  { code: 'Отп', label: 'Отпуск' },
  { code: 'Ст', label: 'Стажёр', hint: 'Не входит в итог часов' },
];
