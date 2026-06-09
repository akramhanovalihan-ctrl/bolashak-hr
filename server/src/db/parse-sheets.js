import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SHEETS_DIR = path.resolve(__dirname, '../../../болашак табель');

export const UNIT_MAP = {
  'Бажова': 'store_bajova',
  'Меновное': 'store_menovnoe',
  'Большенарым': 'store_bolshenarym',
  'ОРЦ Алтай': 'store_orc',
  'Домино': 'store_domino',
  'Шемонайха': 'store_shemonaiha',
  'Калбатау': 'store_kalbatau',
  'Глубокое': 'store_glubokoe',
  'Зеленый': 'store_zelenyi',
  'Иннарус': 'store_innarus',
  'Самарское': 'store_samarskoe',
  'РЦ': 'rc_ust',
  'АУП': 'office_aup',
  'Бухгалтерия': 'office_fin',
  'Ком.отдел': 'office_marketing',
  'CБ': 'security',
  'Старт': 'office_marketing',
  'Фреш Маркет': 'store_orc',
};

const MONTHS_RU = {
  январь: 1, февраль: 2, март: 3, апрель: 4, май: 5, июнь: 6,
  июль: 7, август: 8, сентябрь: 9, октябрь: 10, ноябрь: 11, декабрь: 12,
};

export function extractCells(html) {
  return [...html.matchAll(/<td[^>]*>(.*?)<\/td>/gs)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim());
}

export function parseSummaryEmployees() {
  const html = fs.readFileSync(path.join(SHEETS_DIR, 'сводный.html'), 'utf8');
  const cells = extractCells(html);
  const employees = [];

  for (let i = 0; i < cells.length - 4; i++) {
    const unit = cells[i];
    const code = UNIT_MAP[unit];
    if (!code) continue;
    const full_name = cells[i + 1];
    const hours = cells[i + 2];
    const fine = cells[i + 3];
    const advance = cells[i + 4];
    if (!full_name || full_name.length < 3 || /год|Фактически|Штраф/i.test(full_name)) continue;
    if (!/^[\d\s]+$/.test(String(hours).replace(/\s/g, '')) && !hours) continue;

    const hoursNum = Number(String(hours).replace(/\s/g, ''));
    if (Number.isNaN(hoursNum)) continue;

    employees.push({
      unit_code: code,
      unit_name: unit,
      full_name: full_name.trim(),
      hours_worked: hoursNum,
      fine: Number(String(fine).replace(/\s/g, '')) || 0,
      advance: Number(String(advance).replace(/[^\d]/g, '')) || 0,
      key: `${code}_${full_name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').slice(0, 40)}`,
    });
    i += 4;
  }

  return employees;
}

function findMonthBlock(cells, targetMonth = 1, targetYear = 2026) {
  const monthNames = Object.keys(MONTHS_RU);
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i].toLowerCase();
    const matched = monthNames.find((m) => c.includes(m));
    if (!matched) continue;
    const yearMatch = c.match(/20\d{2}/);
    const year = yearMatch ? Number(yearMatch[0]) : targetYear;
    if (MONTHS_RU[matched] !== targetMonth || year !== targetYear) continue;

    const dayStart = cells.findIndex((v, idx) => idx > i && idx < i + 80 && v === '1' && cells[idx + 1] === '2');
    if (dayStart < 0) continue;

    const fioIdx = cells.findIndex((v, idx) => idx > dayStart && idx < dayStart + 60 && v === 'ФИО');
    if (fioIdx < 0) continue;

    return { dayStart, fioIdx, daysInMonth: 31 };
  }
  return null;
}

export function parseUnitSheetEmployees(filename, month = 1, year = 2026) {
  const html = fs.readFileSync(path.join(SHEETS_DIR, filename), 'utf8');
  const cells = extractCells(html);
  const unitName = filename.replace('.html', '');
  const unitCode = UNIT_MAP[unitName];
  if (!unitCode) return [];

  const block = findMonthBlock(cells, month, year);
  if (!block) return [];

  const { dayStart, fioIdx } = block;
  const daysCount = Number(cells[dayStart + 30]) <= 31 ? 31 : 30;
  const dayOffset = dayStart;
  const rowWidth = daysCount + 3 + 3; // days + № ФИО должность + итого штраф аванс approx

  const employees = [];
  let row = fioIdx + 3; // skip № ФИО Должность header row

  while (row < cells.length - daysCount) {
    const num = cells[row];
    const full_name = cells[row + 1];
    const position = cells[row + 2];

    if (!full_name || full_name === 'ФИО' || /^№$/.test(full_name)) {
      row += 1;
      continue;
    }
    if (/^\d{4}$/.test(full_name) || /год|январ|феврал|март|апрел|май|июн|июл|август|сентябр|октябр|ноябр|декабр/i.test(full_name)) break;
    if (full_name.length < 2) { row += 1; continue; }

    const dayData = {};
    for (let d = 1; d <= daysCount; d++) {
      const val = cells[row + 2 + d] ?? '';
      if (val !== '') dayData[String(d).padStart(2, '0')] = val;
    }

    const totalIdx = row + 2 + daysCount + 1;
    const hours_worked = Number(String(cells[totalIdx] || '0').replace(/\s/g, '')) || 0;
    const fine = Number(String(cells[totalIdx + 1] || '0').replace(/\s/g, '')) || 0;
    const advance = Number(String(cells[totalIdx + 2] || '0').replace(/[^\d]/g, '')) || 0;

    employees.push({
      unit_code: unitCode,
      full_name,
      position: position || 'Сотрудник',
      employee_number: String(num || employees.length + 1),
      day_data: dayData,
      hours_worked,
      fine,
      advance,
      key: `${unitCode}_${full_name.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').slice(0, 40)}`,
    });

    row += rowWidth;
    if (employees.length > 80) break;
  }

  return employees;
}

export function loadAllSheetData() {
  const summary = parseSummaryEmployees();
  const byKey = new Map();

  for (const emp of summary) {
    byKey.set(emp.key, { ...emp, position: emp.position || 'Сотрудник' });
  }

  const unitFiles = fs.readdirSync(SHEETS_DIR).filter((f) => f.endsWith('.html') && !['Инструкция.html', 'сводный.html'].includes(f));
  for (const file of unitFiles) {
    try {
      const rows = parseUnitSheetEmployees(file);
      for (const emp of rows) {
        const existing = byKey.get(emp.key);
        byKey.set(emp.key, { ...existing, ...emp });
      }
    } catch { /* skip broken sheets */ }
  }

  return [...byKey.values()].filter((e) => e.full_name && e.full_name.length > 2);
}

if (process.argv[1]?.includes('parse-sheets')) {
  const data = loadAllSheetData();
  console.log('Loaded employees:', data.length);
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
  const byUnit = {};
  for (const e of data) byUnit[e.unit_code] = (byUnit[e.unit_code] || 0) + 1;
  console.log('By unit:', byUnit);
}
