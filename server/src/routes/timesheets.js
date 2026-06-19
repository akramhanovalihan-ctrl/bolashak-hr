import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { sqlScalarSubquery } from '../db/sql-dialect.js';
import { employees, timesheetEntries, timesheets, units, users } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';
import {
  buildDefaultShiftData,
  calcHoursFromShiftData,
  calcMonthlyHoursNorm,
  dayKey,
  getDaysInMonth,
} from '../utils/timesheet.js';
import { syncPayrollForPeriod } from './payroll.js';

const router = Router();

const hrApproverSubquery = sqlScalarSubquery(
  'full_name',
  `FROM ${users} WHERE role = 'hr' AND is_active = 1`,
  'created_at'
);

function monthlyNorm(unit, year, month) {
  return calcMonthlyHoursNorm(year, month, unit.schedule_type);
}

async function syncEmployeesToTimesheet(timesheetId, unitId, year, month, hoursNorm) {
  await query(
    `DELETE FROM ${timesheetEntries}
     WHERE timesheet_id = $1 AND employee_id IN (
       SELECT e.id FROM ${employees} e
       WHERE e.employee_number LIKE 'tmp_%' OR e.unit_id <> $2 OR e.status <> 'active'
     )`,
    [timesheetId, unitId]
  );

  const { rows: emps } = await query(
    `SELECT id FROM ${employees} WHERE unit_id = $1 AND status = 'active' ORDER BY full_name`,
    [unitId]
  );
  const { rows: existing } = await query(
    `SELECT employee_id FROM ${timesheetEntries} WHERE timesheet_id = $1`,
    [timesheetId]
  );
  const existingIds = new Set(existing.map((r) => r.employee_id));

  for (const emp of emps) {
    if (existingIds.has(emp.id)) continue;
    const shiftData = buildDefaultShiftData(year, month);
    await query(
      `INSERT INTO ${timesheetEntries} (id, timesheet_id, employee_id, hours_worked, hours_norm, shift_data, fine_amount, advance_amount)
       VALUES ($1,$2,$3,0,$4,$5,0,0)`,
      [randomUUID(), timesheetId, emp.id, hoursNorm, JSON.stringify(shiftData)]
    );
  }
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const scoped = scopeByUnit(req);
  const params = [];
  let sql = `SELECT t.*, u.name AS unit_name, u.schedule_type, m.full_name AS manager_name,
                    ${hrApproverSubquery} AS hr_approver_name
             FROM ${timesheets} t
             JOIN ${units} u ON u.id = t.unit_id
             LEFT JOIN ${users} m ON m.id = u.manager_user_id
             WHERE 1=1`;
  if (scoped) { sql += ' AND t.unit_id = $1'; params.push(scoped); }
  if (req.query.unit_id) { params.push(req.query.unit_id); sql += ` AND t.unit_id = $${params.length}`; }
  if (req.query.year) { params.push(Number(req.query.year)); sql += ` AND t.year = $${params.length}`; }
  if (req.query.month) { params.push(Number(req.query.month)); sql += ` AND t.month = $${params.length}`; }
  sql += ' ORDER BY t.year DESC, t.month DESC';
  const { rows } = await query(sql, params);
  res.json({ timesheets: rows });
});

router.post('/generate', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { unit_id, year, month } = req.body;
  const scoped = scopeByUnit(req);
  if (scoped && scoped !== unit_id) return res.status(403).json({ error: 'Нет доступа к этому подразделению' });

  const { rows: unitRows } = await query(`SELECT * FROM ${units} WHERE id = $1`, [unit_id]);
  const unit = unitRows[0];
  if (!unit) return res.status(404).json({ error: 'Подразделение не найдено' });

  const existing = await query(
    `SELECT * FROM ${timesheets} WHERE unit_id = $1 AND year = $2 AND month = $3`,
    [unit_id, year, month]
  );
  const planHours = monthlyNorm(unit, year, month);

  if (existing.rows[0]) {
    if (existing.rows[0].status === 'draft') {
      await syncEmployeesToTimesheet(existing.rows[0].id, unit_id, year, month, planHours);
    }
    const { rows: refreshed } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [existing.rows[0].id]);
    return res.json({ timesheet: { ...refreshed[0], hours_norm_planned: planHours }, exists: true });
  }

  const tsId = randomUUID();
  await query(
    `INSERT INTO ${timesheets} (id, unit_id, year, month, schedule_type_snapshot, status)
     VALUES ($1,$2,$3,$4,$5,'draft')`,
    [tsId, unit_id, year, month, unit.schedule_type]
  );

  await syncEmployeesToTimesheet(tsId, unit_id, year, month, planHours);

  const { rows } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [tsId]);
  res.status(201).json({ timesheet: { ...rows[0], hours_norm_planned: planHours } });
});

router.get('/:id/entries', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { rows: ts } = await query(
    `SELECT t.*, u.name AS unit_name, u.schedule_type, m.full_name AS manager_name,
            ${hrApproverSubquery} AS hr_approver_name
     FROM ${timesheets} t
     JOIN ${units} u ON u.id = t.unit_id
     LEFT JOIN ${users} m ON m.id = u.manager_user_id
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });

  const planHours = calcMonthlyHoursNorm(ts[0].year, ts[0].month, ts[0].schedule_type_snapshot || ts[0].schedule_type);

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== ts[0].unit_id) return res.status(403).json({ error: 'Нет доступа' });

  const { rows } = await query(
    `SELECT e.id, e.employee_id, e.hours_worked, e.hours_norm, e.shift_data, e.absence_data, e.notes,
            e.fine_amount, e.advance_amount,
            emp.full_name, emp.position, emp.employee_number
     FROM ${timesheetEntries} e
     JOIN ${employees} emp ON emp.id = e.employee_id
     WHERE e.timesheet_id = $1 ORDER BY emp.full_name`,
    [req.params.id]
  );

  const entries = rows.map((r, idx) => ({
    ...r,
    row_num: idx + 1,
    shift_data: typeof r.shift_data === 'string' ? JSON.parse(r.shift_data || '{}') : r.shift_data,
    absence_data: typeof r.absence_data === 'string' ? JSON.parse(r.absence_data || '[]') : r.absence_data,
  }));

  res.json({ timesheet: { ...ts[0], hours_norm_planned: planHours }, entries });
});

router.post('/:id/entries', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { employee_id } = req.body;
  const { rows: ts } = await query(`SELECT t.*, u.hours_norm_default FROM ${timesheets} t JOIN ${units} u ON u.id = t.unit_id WHERE t.id = $1`, [req.params.id]);
  if (!ts[0] || ts[0].status !== 'draft') return res.status(400).json({ error: 'Табель недоступен для редактирования' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== ts[0].unit_id) return res.status(403).json({ error: 'Нет доступа' });

  let empId = employee_id;
  if (!empId) {
    return res.status(400).json({ error: 'Выберите сотрудника из списка подразделения' });
  }

  const { rows: empCheck } = await query(
    `SELECT id FROM ${employees} WHERE id = $1 AND unit_id = $2 AND status = 'active'`,
    [empId, ts[0].unit_id]
  );
  if (!empCheck[0]) {
    return res.status(400).json({ error: 'Сотрудник не найден в этом подразделении' });
  }

  const { rows: dup } = await query(
    `SELECT id FROM ${timesheetEntries} WHERE timesheet_id = $1 AND employee_id = $2`,
    [req.params.id, empId]
  );
  if (dup[0]) {
    return res.status(400).json({ error: 'Этот сотрудник уже есть в табеле' });
  }

  const shiftData = buildDefaultShiftData(ts[0].year, ts[0].month);
  const entryId = randomUUID();
  await query(
    `INSERT INTO ${timesheetEntries} (id, timesheet_id, employee_id, hours_worked, hours_norm, shift_data, fine_amount, advance_amount)
     VALUES ($1,$2,$3,0,$4,$5,0,0)`,
    [entryId, req.params.id, empId, ts[0].hours_norm_default, JSON.stringify(shiftData)]
  );

  res.status(201).json({ ok: true, entry_id: entryId });
});

router.put('/:id/entries', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { entries } = req.body;
  const { rows: ts } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [req.params.id]);
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });
  if (ts[0].status === 'approved') return res.status(400).json({ error: 'Табель утверждён' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== ts[0].unit_id) return res.status(403).json({ error: 'Нет доступа' });

  for (const entry of entries) {
    const shiftData = { ...(entry.shift_data || {}) };
    const hours = calcHoursFromShiftData(shiftData, ts[0].schedule_type_snapshot);
    shiftData.total_hours = hours;

    if (entry.employee_id) {
      await query(
        `UPDATE ${timesheetEntries} SET employee_id = $1 WHERE id = $2 AND timesheet_id = $3`,
        [entry.employee_id, entry.id, req.params.id]
      );
    }

    await query(
      `UPDATE ${timesheetEntries}
       SET hours_worked = $1, shift_data = $2, absence_data = $3, notes = $4,
           fine_amount = $5, advance_amount = $6,
           hours_norm = COALESCE($7, hours_norm)
       WHERE id = $8 AND timesheet_id = $9`,
      [
        hours,
        JSON.stringify(shiftData),
        JSON.stringify(entry.absence_data || []),
        entry.notes || null,
        entry.fine_amount || 0,
        entry.advance_amount || 0,
        entry.hours_norm != null ? Number(entry.hours_norm) : null,
        entry.id,
        req.params.id,
      ]
    );
  }
  res.json({ ok: true });
});

router.post('/:id/submit', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { rows } = await query(`SELECT status, unit_id FROM ${timesheets} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Табель не найден' });
  if (!['draft', 'rejected'].includes(rows[0].status)) {
    return res.status(400).json({ error: 'Сдать можно только черновик или отклонённый табель' });
  }
  const scoped = scopeByUnit(req);
  if (scoped && scoped !== rows[0].unit_id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  await query(`UPDATE ${timesheets} SET status = 'submitted' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/approve', requireAuth, requireRoles('hr', 'admin'), async (req, res) => {
  const { rows: ts } = await query(
    `SELECT status, unit_id, year, month FROM ${timesheets} WHERE id = $1`,
    [req.params.id]
  );
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });
  if (ts[0].status !== 'submitted') {
    return res.status(400).json({ error: 'Утвердить можно только сданный табель' });
  }
  await query(
    `UPDATE ${timesheets} SET status = 'approved', approved_by = $1, approved_at = $2 WHERE id = $3`,
    [req.user.id, new Date().toISOString(), req.params.id]
  );
  try {
    await syncPayrollForPeriod(ts[0].year, ts[0].month, ts[0].unit_id);
  } catch (err) {
    console.error('Payroll sync after timesheet approve:', err.message);
  }
  res.json({ ok: true });
});

router.post('/:id/reject', requireAuth, requireRoles('hr', 'admin'), async (req, res) => {
  const { rows: ts } = await query(`SELECT status FROM ${timesheets} WHERE id = $1`, [req.params.id]);
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });
  if (ts[0].status !== 'submitted') {
    return res.status(400).json({ error: 'Отклонить можно только сданный табель' });
  }
  const reason = req.body?.reason || '';
  await query(
    `UPDATE ${timesheets} SET status = 'rejected', approved_by = NULL, approved_at = NULL WHERE id = $1`,
    [req.params.id]
  );
  const { notifyRoles } = await import('../services/notify.js');
  await notifyRoles(['manager'], {
    title: 'Табель отклонён',
    body: reason ? `Причина: ${reason}` : 'HR отклонил табель. Внесите исправления и сдайте снова.',
    link: '/timesheets',
  });
  res.json({ ok: true });
});

export default router;
