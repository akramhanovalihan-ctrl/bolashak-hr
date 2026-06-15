import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ORG_CHART_CANDIDATES = [
  path.resolve(__dirname, '../../../bolashak-org-base/bolashak_org_chart.html'),
  path.resolve(__dirname, '../../../новый табель сотрудников база/bolashak_org_chart.html'),
];

export const ORG_CHART_PATH = ORG_CHART_CANDIDATES.find((p) => fs.existsSync(p)) || ORG_CHART_CANDIDATES[0];

const DEPT_UNIT_MAP = {
  'IT-отдел': 'it',
  'Отдел маркетинга': 'office_marketing',
  'Коммерческий отдел': 'office_commercial',
  'Бухгалтерия': 'office_fin',
  'Служба безопасности': 'security',
  'HR-отдел': 'office_hr',
  'РЦ и логистика': 'rc_ust',
};

const STORE_NAME_MAP = {
  'ОРЦ Алтай': 'store_orc',
  'Домино': 'store_domino',
  'Меновное': 'store_menovnoe',
  'Бажова': 'store_bajova',
  'Иннарус': 'store_innarus',
  'Большенарым': 'store_bolshenarym',
};

function parseStoreUnit(name) {
  const m = String(name).match(/ТТ\s*"([^"]+)"/);
  if (!m) return null;
  return STORE_NAME_MAP[m[1]] || null;
}

function unitFromRole(role) {
  for (const [storeName, code] of Object.entries(STORE_NAME_MAP)) {
    if (role.includes(`(${storeName})`)) return code;
  }
  return null;
}

function isVacancy(node) {
  return Boolean(node.vacancy) || String(node.name || '').trim().startsWith('—');
}

function isDepartmentNode(node) {
  if (node.type !== 'dept-head') return false;
  if (parseStoreUnit(node.name)) return true;
  if (DEPT_UNIT_MAP[node.name]) return true;
  if (/ТТ\s*"/.test(node.name)) return true;
  if (/отдел|логистика/i.test(node.name) && !/^[А-ЯЁA-Z][а-яёa-z]+\s+[А-ЯЁA-Z]/.test(node.name)) return true;
  return false;
}

function employmentType(node) {
  if (node.outsource) return 'contractor';
  if (node.pt) return 'part';
  return 'full';
}

function staffCategory(node) {
  const role = String(node.role || '').toLowerCase();
  if (/директор|рук\.|главный|исполнительный|собственник|ст\.|старший/.test(role)) return 'manager';
  if (/программист|администратор|бухгалтер|менеджер|оператор|рекрутер|ревизор/.test(role)) return 'specialist';
  return 'worker';
}

function makeKey(unitCode, fullName) {
  return `${unitCode}_${fullName.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').slice(0, 40)}`;
}

export function extractOrgChartData(html) {
  const match = html.match(/const data\s*=\s*(\{[\s\S]*?\n\});/);
  if (!match) throw new Error('Не найден блок const data в org chart');
  return Function(`"use strict"; return (${match[1]});`)();
}

function walk(node, unitCode, out, seen) {
  if (!node || isVacancy(node)) return;

  let currentUnit = unitCode;
  if (isDepartmentNode(node)) {
    currentUnit = parseStoreUnit(node.name) || DEPT_UNIT_MAP[node.name] || unitCode;
  }

  const isPerson = node.type !== 'head' && !isDepartmentNode(node) && node.name?.trim();
  const roleUnit = unitFromRole(node.role || '');
  let empUnit = roleUnit || currentUnit;
  if (!empUnit && isPerson) {
    if (node.outsource) empUnit = 'office_fin';
    else if (node.type === 'dept-head' || node.type === 'exec') empUnit = 'office_aup';
  }
  if (isPerson && empUnit) {
    const full_name = node.name.trim();
    const key = makeKey(empUnit, full_name);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        key,
        unit_code: empUnit,
        full_name,
        position: node.role || 'Сотрудник',
        employment_type: employmentType(node),
        staff_category: staffCategory(node),
        salary: node.pt ? 150000 : 200000,
        is_sub: Boolean(node.sub),
        is_outsource: Boolean(node.outsource),
      });
    }
  }

  if (node.type === 'exec' && node.name?.trim() && !empUnit) {
    const full_name = node.name.trim();
    const code = 'office_aup';
    const key = makeKey(code, full_name);
    if (!seen.has(key)) {
      seen.add(key);
      out.push({
        key,
        unit_code: code,
        full_name,
        position: node.role || 'Руководитель',
        employment_type: employmentType(node),
        staff_category: 'manager',
        salary: 500000,
      });
    }
    currentUnit = 'office_aup';
  }

  for (const child of node.children || []) {
    walk(child, currentUnit, out, seen);
  }
}

export function loadOrgChartEmployees() {
  if (!fs.existsSync(ORG_CHART_PATH)) return [];
  const html = fs.readFileSync(ORG_CHART_PATH, 'utf8');
  const data = extractOrgChartData(html);
  const employees = [];
  const seen = new Set();
  walk(data, null, employees, seen);
  return employees.filter((e) => e.full_name.length > 2);
}

export function loadOrgChartManagers() {
  const managers = {
    store_bajova: 'Финаев Иван',
    store_menovnoe: 'Заргумбаева Альфия',
    store_orc: 'Аскарова Алина',
    store_domino: 'Гусева Майя',
    store_innarus: 'Саркисова Мила',
    store_bolshenarym: 'Жиренчинов Даурен',
    rc_ust: 'Жумагулова Айсана',
    office_fin: 'Бибишева Ляззат',
    security: 'Унарбеков Ернар',
    office_marketing: 'Халелова Диана',
    office_commercial: 'Шаниязова Раушан',
    office_hr: 'Нагашыбаева Талшын',
    it: 'Акрамханов Алихан',
    office_aup: 'Мейрманова Айзада',
  };
  return managers;
}

if (process.argv[1]?.includes('parse-org-chart')) {
  const data = loadOrgChartEmployees();
  console.log('Source:', ORG_CHART_PATH);
  console.log('Loaded employees:', data.length);
  const byUnit = {};
  for (const e of data) byUnit[e.unit_code] = (byUnit[e.unit_code] || 0) + 1;
  console.log('By unit:', byUnit);
  console.log(JSON.stringify(data.slice(0, 8), null, 2));
}
