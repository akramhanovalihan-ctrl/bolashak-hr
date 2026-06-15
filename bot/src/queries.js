import { randomUUID } from 'crypto';
import { query } from '../../server/src/db/index.js';
import { sqlLimit } from '../../server/src/db/sql-dialect.js';
import {
  employees, units, timesheets, timesheetEntries, payroll,
  vacations, shiftSchedules, onboardingTasks, pulseSurveys, users,
} from '../../server/src/db/tables.js';
import { startOnboardingForEmployee } from '../../server/src/services/onboarding-start.js';

const VAC_TYPE_MAP = {
  day_off: 'UL',
  vacation: 'AL',
  sick: 'SL',
  personal: 'UL',
};

const VAC_LABELS = { AL: 'Отпуск', SL: 'Больничный', UL: 'Отгул/без оплаты', EL: 'Учебный', ML: 'Декрет', BT: 'Командировка' };
const STATUS_LABELS = { pending: 'Ожидает', manager_ok: 'Согласовано руководителем', approved: 'Утверждено', rejected: 'Отклонено' };

function nowYm() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export async function getEmployeeTimesheet(employeeId, unitId) {
  const { year, month } = nowYm();
  const { rows: ts } = await query(
    `SELECT * FROM ${timesheets} WHERE unit_id = $1 AND year = $2 AND month = $3`,
    [unitId, year, month]
  );
  if (!ts[0]) return { year, month, status: 'нет табеля', hours: 0, norm: 0 };
  const { rows: entry } = await query(
    `SELECT * FROM ${timesheetEntries} WHERE timesheet_id = $1 AND employee_id = $2`,
    [ts[0].id, employeeId]
  );
  const e = entry[0] || {};
  return {
    year,
    month,
    status: ts[0].status,
    hours: e.hours_worked || 0,
    norm: e.hours_norm || 0,
    shift_data: typeof e.shift_data === 'string' ? JSON.parse(e.shift_data || '{}') : e.shift_data,
  };
}

export async function getEmployeePayroll(employeeId) {
  const { year, month } = nowYm();
  const { rows } = await query(
    `SELECT * FROM ${payroll} WHERE employee_id = $1 AND year = $2 AND month = $3`,
    [employeeId, year, month]
  );
  return rows[0] || null;
}

export async function getShiftSchedule(unitId) {
  const { year, month } = nowYm();
  const { rows } = await query(
    `SELECT schedule_data, status FROM ${shiftSchedules} WHERE unit_id = $1 AND year = $2 AND month = $3`,
    [unitId, year, month]
  );
  if (!rows[0]?.schedule_data) return null;
  const data = typeof rows[0].schedule_data === 'string'
    ? JSON.parse(rows[0].schedule_data) : rows[0].schedule_data;
  return { status: rows[0].status, data };
}

export async function getUnitTimesheet(unitId) {
  const { year, month } = nowYm();
  const { rows: ts } = await query(
    `SELECT t.*, u.name AS unit_name FROM ${timesheets} t JOIN ${units} u ON u.id = t.unit_id
     WHERE t.unit_id = $1 AND t.year = $2 AND t.month = $3`,
    [unitId, year, month]
  );
  if (!ts[0]) return null;
  const { rows: entries } = await query(
    `SELECT te.*, e.full_name FROM ${timesheetEntries} te
     JOIN ${employees} e ON e.id = te.employee_id
     WHERE te.timesheet_id = $1 ORDER BY e.full_name`,
    [ts[0].id]
  );
  return { timesheet: ts[0], entries, year, month };
}

export async function createVacationRequest({ employeeId, unitId, leaveType, dateFrom, dateTo }) {
  const id = randomUUID();
  const type = VAC_TYPE_MAP[leaveType] || 'UL';
  const days = daysBetween(dateFrom, dateTo);
  await query(
    `INSERT INTO ${vacations} (id, employee_id, unit_id, type, date_from, date_to, days_count, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
    [id, employeeId, unitId, type, dateFrom, dateTo, days]
  );
  return { id, type, days };
}

export async function getEmployeeVacations(employeeId) {
  const { rows } = await query(
    `SELECT * FROM ${vacations} WHERE employee_id = $1 ORDER BY created_at DESC ${sqlLimit(10)}`,
    [employeeId]
  );
  return rows.map((v) => ({
    ...v,
    type_label: VAC_LABELS[v.type] || v.type,
    status_label: STATUS_LABELS[v.status] || v.status,
  }));
}

export async function getVacationById(id) {
  const { rows } = await query(
    `SELECT v.*, e.full_name, e.telegram_id, u.name AS unit_name
     FROM ${vacations} v
     JOIN ${employees} e ON e.id = v.employee_id
     JOIN ${units} u ON u.id = v.unit_id
     WHERE v.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function approveVacation(id, approverRole) {
  const status = approverRole === 'manager' ? 'manager_ok' : 'approved';
  await query(`UPDATE ${vacations} SET status = $1 WHERE id = $2`, [status, id]);
}

export async function rejectVacation(id, reason) {
  await query(`UPDATE ${vacations} SET status = 'rejected', reason = $1 WHERE id = $2`, [reason || null, id]);
}

export async function getManagerTelegramIds(unitId) {
  const { rows: unit } = await query(`SELECT manager_user_id FROM ${units} WHERE id = $1`, [unitId]);
  if (!unit[0]?.manager_user_id) return [];
  const { rows } = await query(
    `SELECT e.telegram_id FROM ${users} u
     JOIN ${employees} e ON e.id = u.employee_id
     WHERE u.id = $1 AND e.telegram_id IS NOT NULL`,
    [unit[0].manager_user_id]
  );
  return rows.map((r) => r.telegram_id).filter(Boolean);
}

export async function getHrAdminTelegramIds() {
  const { rows } = await query(
    `SELECT e.telegram_id FROM ${users} u
     JOIN ${employees} e ON e.id = u.employee_id
     WHERE u.role IN ('hr','admin') AND u.is_active = 1 AND e.telegram_id IS NOT NULL`
  );
  return rows.map((r) => r.telegram_id).filter(Boolean);
}

export async function getOnboardingForUnit(unitId) {
  const { rows } = await query(
    `SELECT t.*, e.full_name FROM ${onboardingTasks} t
     JOIN ${employees} e ON e.id = t.employee_id
     WHERE e.unit_id = $1 AND t.task_type = 'onboard' AND t.status = 'pending'
     ORDER BY e.full_name, t.due_date`,
    [unitId]
  );
  return rows;
}

export async function getAllOnboarding() {
  const { rows } = await query(
    `SELECT t.*, e.full_name, u.name AS unit_name FROM ${onboardingTasks} t
     JOIN ${employees} e ON e.id = t.employee_id
     JOIN ${units} u ON u.id = e.unit_id
     WHERE t.task_type = 'onboard'
     ORDER BY e.full_name, t.due_date`
  );
  return rows;
}

export async function completeOnboardingTask(taskId) {
  await query(`UPDATE ${onboardingTasks} SET status = 'done' WHERE id = $1`, [taskId]);
}

export async function createEmployee({ full_name, phone, unit_id, position, employment_type, hire_date }) {
  const id = randomUUID();
  const empNum = `TG${Date.now().toString(36).toUpperCase()}`;
  await query(
    `INSERT INTO ${employees}
     (id, full_name, birth_date, unit_id, position, employment_type, hire_date, phone, employee_number, status)
     VALUES ($1,$2,'1990-01-01',$3,$4,$5,$6,$7,$8,'active')`,
    [id, full_name, unit_id, position, employment_type || 'full', hire_date, phone || null, empNum]
  );
  await startOnboardingForEmployee(id, 'onboard', hire_date);
  return id;
}

export async function listUnits() {
  const { rows } = await query(`SELECT id, name, code FROM ${units} WHERE is_active = 1 ORDER BY name`);
  return rows;
}

export async function getDashboardStats() {
  const active = 'active';
  const { rows: total } = await query(`SELECT COUNT(*) AS c FROM ${employees} WHERE status = $1`, [active]);
  const { rows: pendingVac } = await query(`SELECT COUNT(*) AS c FROM ${vacations} WHERE status IN ('pending','manager_ok')`);
  const { rows: pendingOnb } = await query(`SELECT COUNT(*) AS c FROM ${onboardingTasks} WHERE status = 'pending' AND task_type = 'onboard'`);
  const qStart = new Date();
  qStart.setMonth(qStart.getMonth() - 3);
  const { rows: terminated } = await query(
    `SELECT COUNT(*) AS c FROM ${employees} WHERE status = 'terminated' AND termination_date >= $1`,
    [qStart.toISOString().slice(0, 10)]
  );
  return {
    total_employees: total[0]?.c || 0,
    pending_vacations: pendingVac[0]?.c || 0,
    pending_onboarding: pendingOnb[0]?.c || 0,
    terminated_quarter: terminated[0]?.c || 0,
  };
}

export async function listAllEmployees() {
  const { rows } = await query(
    `SELECT e.full_name, e.position, e.status, e.salary, u.name AS unit_name
     FROM ${employees} e LEFT JOIN ${units} u ON u.id = e.unit_id
     ORDER BY u.name, e.full_name ${sqlLimit(50)}`
  );
  return rows;
}

export async function getTurnoverStats() {
  const qStart = new Date();
  qStart.setMonth(qStart.getMonth() - 3);
  const { rows } = await query(
    `SELECT u.name, COUNT(e.id) AS cnt FROM ${employees} e
     JOIN ${units} u ON u.id = e.unit_id
     WHERE e.status = 'terminated' AND e.termination_date >= $1
     GROUP BY u.id, u.name ORDER BY cnt DESC`,
    [qStart.toISOString().slice(0, 10)]
  );
  return rows;
}

export async function savePulseAnswer({ unitId, q1, q2, q3, comment }) {
  const id = randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  await query(
    `INSERT INTO ${pulseSurveys} (id, unit_id, survey_date, q1_score, q2_score, q3_score, comment)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, unitId, today, q1, q2, q3, comment || null]
  );
}

export async function getPulseSummary() {
  const monthStart = new Date();
  monthStart.setDate(1);
  const { rows } = await query(
    `SELECT u.name, AVG(p.q1_score) AS q1, AVG(p.q2_score) AS q2, AVG(p.q3_score) AS q3, COUNT(*) AS responses
     FROM ${pulseSurveys} p JOIN ${units} u ON u.id = p.unit_id
     WHERE p.survey_date >= $1 GROUP BY u.id, u.name ORDER BY u.name`,
    [monthStart.toISOString().slice(0, 10)]
  );
  return rows;
}

export { VAC_LABELS, STATUS_LABELS };
