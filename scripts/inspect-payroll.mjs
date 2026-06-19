import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(__dirname, '../server/.env'), 'utf8').split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  const key = t.slice(0, i).trim();
  if (!(key in process.env)) process.env[key] = t.slice(i + 1).trim();
}

const { query } = await import('../server/src/db/index.js');

const { rows: approved } = await query(
  `SELECT u.name, t.year, t.month FROM hr.hr_timesheets t
   JOIN hr.hr_units u ON u.id = t.unit_id WHERE t.status = 'approved'`
);
console.log('Approved timesheets:', approved.length);
approved.forEach((r) => console.log(' ', r.name, r.year, r.month));

const { rows: june } = await query(`SELECT COUNT(*) AS cnt FROM hr.hr_payroll WHERE year = 2026 AND month = 6`);
const { rows: juneAup } = await query(
  `SELECT COUNT(*) AS cnt FROM hr.hr_payroll p
   JOIN hr.hr_units u ON u.id = p.unit_id
   WHERE p.year = 2026 AND p.month = 6 AND u.code = 'office_aup'`
);
const { rows: zeros } = await query(
  `SELECT COUNT(*) AS cnt FROM hr.hr_payroll
   WHERE year = 2026 AND month = 6 AND ISNULL(hours_worked,0)=0 AND ISNULL(final_amount,0)=0`
);
const { rows: sample } = await query(
  `SELECT TOP 8 p.final_amount, p.hours_worked, p.monthly_salary, u.name
   FROM hr.hr_payroll p JOIN hr.hr_units u ON u.id = p.unit_id
   WHERE p.year = 2026 AND p.month = 6 ORDER BY p.final_amount DESC`
);
console.log('June payroll total:', june[0].cnt, 'AUP:', juneAup[0].cnt, 'zero final:', zeros[0].cnt);
console.log('Sample:', sample);
