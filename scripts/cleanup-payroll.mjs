/**
 * Удаляет «мусорные» строки ведомости, созданные старой логикой sync
 * (до фильтра только по утверждённым табелям).
 *
 * Запуск: node scripts/cleanup-payroll.mjs
 * Dry-run: node scripts/cleanup-payroll.mjs --dry-run
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const file = path.join(__dirname, '../server/.env');
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    if (!(key in process.env)) process.env[key] = t.slice(i + 1).trim();
  }
}

loadEnv();

const { query } = await import('../server/src/db/index.js');
const dryRun = process.argv.includes('--dry-run');

const schema = process.env.DB_DRIVER === 'sqlite' ? '' : 'hr.';
const payroll = `${schema}hr_payroll`;
const timesheets = `${schema}hr_timesheets`;
const entries = `${schema}hr_timesheet_entries`;

const preserveManual = `
  AND ISNULL(p.hours_worked, 0) = 0
  AND ISNULL(p.final_amount, 0) = 0
  AND ISNULL(p.manual_deductions, 0) = 0
  AND ISNULL(p.bonuses, 0) = 0
  AND ISNULL(p.advance_paid, 0) = 0
  AND ISNULL(p.deductions, 0) = 0
`;

async function count(sql) {
  const { rows } = await query(sql);
  return Number(rows[0]?.cnt || 0);
}

async function run() {
  console.log(dryRun ? '=== Dry-run ===' : '=== Cleanup payroll ===');

  const q1 = `
    SELECT COUNT(*) AS cnt FROM ${payroll} p
    WHERE NOT EXISTS (
      SELECT 1 FROM ${timesheets} t
      WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
    )
    ${preserveManual.replace(/\bp\./g, 'p.')}
  `;

  const q2 = `
    SELECT COUNT(*) AS cnt FROM ${payroll} p
    WHERE EXISTS (
      SELECT 1 FROM ${timesheets} t
      WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM ${timesheets} t
      JOIN ${entries} te ON te.timesheet_id = t.id
      WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
        AND te.employee_id = p.employee_id
    )
    ${preserveManual}
  `;

  const before = await count(`SELECT COUNT(*) AS cnt FROM ${payroll}`);
  const n1 = await count(q1);
  const n2 = await count(q2);

  console.log(`Всего строк ведомости: ${before}`);
  console.log(`К удалению (нет утвержд. табеля, все нули): ${n1}`);
  console.log(`К удалению (не в утвержд. табеле, все нули): ${n2}`);

  if (dryRun) {
    console.log('Запустите без --dry-run для удаления.');
    return;
  }

  if (n1 > 0) {
    await query(`
      DELETE p FROM ${payroll} p
      WHERE NOT EXISTS (
        SELECT 1 FROM ${timesheets} t
        WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
      )
      ${preserveManual}
    `);
  }

  if (n2 > 0) {
    await query(`
      DELETE p FROM ${payroll} p
      WHERE EXISTS (
        SELECT 1 FROM ${timesheets} t
        WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${timesheets} t
        JOIN ${entries} te ON te.timesheet_id = t.id
        WHERE t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month AND t.status = 'approved'
          AND te.employee_id = p.employee_id
      )
      ${preserveManual}
    `);
  }

  const after = await count(`SELECT COUNT(*) AS cnt FROM ${payroll}`);
  console.log(`Удалено: ${before - after}. Осталось: ${after}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
