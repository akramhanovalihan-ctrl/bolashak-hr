import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, timesheetEntries, timesheets, units } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';
import {
  buildDefaultShiftData,
  calcHoursFromShiftData,
  dayKey,
  getDaysInMonth,
} from '../utils/timesheet.js';

const router = Router();

async function syncEmployeesToTimesheet(timesheetId, unitId, year, month, scheduleType, hoursNorm) {
  const { rows: emps } = await query(
    `SELECT id FROM ${employees} WHERE unit_id = $1 AND status = 'active'`,
    [unitId]
  );
  const { rows: existing } = await query(
    `SELECT employee_id FROM ${timesheetEntries} WHERE timesheet_id = $1`,
    [timesheetId]
  );
  const existingIds = new Set(existing.map((r) => r.employee_id));

  for (const emp of emps) {
    if (existingIds.has(emp.id)) continue;
    const shiftData = buildDefaultShiftData(year, month, scheduleType);
    const hours = calcHoursFromShiftData(shiftData, scheduleType);
    await query(
      `INSERT INTO ${timesheetEntries} (id, timesheet_id, employee_id, hours_worked, hours_norm, shift_data)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), timesheetId, emp.id, hours, hoursNorm, JSON.stringify(shiftData)]
    );
  }
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const scoped = scopeByUnit(req);
  const params = [];
  let sql = `SELECT t.*, u.name AS unit_name FROM ${timesheets} t JOIN ${units} u ON u.id = t.unit_id WHERE 1=1`;
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
  if (scoped && scoped !== unit_id) return res.status(403).json({ error: 'Нет доступа' });

  const { rows: unitRows } = await query(`SELECT * FROM ${units} WHERE id = $1`, [unit_id]);
  const unit = unitRows[0];
  if (!unit) return res.status(404).json({ error: 'Подразделение не найдено' });

  const existing = await query(
    `SELECT * FROM ${timesheets} WHERE unit_id = $1 AND year = $2 AND month = $3`,
    [unit_id, year, month]
  );
  if (existing.rows[0]) {
    if (existing.rows[0].status === 'draft') {
      await syncEmployeesToTimesheet(
        existing.rows[0].id, unit_id, year, month,
        existing.rows[0].schedule_type_snapshot, unit.hours_norm_default
      );
    }
    return res.json({ timesheet: existing.rows[0], exists: true });
  }

  const tsId = randomUUID();
  await query(
    `INSERT INTO ${timesheets} (id, unit_id, year, month, schedule_type_snapshot, status)
     VALUES ($1,$2,$3,$4,$5,'draft')`,
    [tsId, unit_id, year, month, unit.schedule_type]
  );

  await syncEmployeesToTimesheet(tsId, unit_id, year, month, unit.schedule_type, unit.hours_norm_default);

  const { rows } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [tsId]);
  res.status(201).json({ timesheet: rows[0] });
});

router.get('/:id/entries', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { rows: ts } = await query(`SELECT t.*, u.name AS unit_name FROM ${timesheets} t JOIN ${units} u ON u.id = t.unit_id WHERE t.id = $1`, [req.params.id]);
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== ts[0].unit_id) return res.status(403).json({ error: 'Нет доступа' });

  const { rows } = await query(
    `SELECT e.id, e.employee_id, e.hours_worked, e.hours_norm, e.shift_data, e.absence_data, e.notes,
            emp.full_name, emp.position
     FROM ${timesheetEntries} e
     JOIN ${employees} emp ON emp.id = e.employee_id
     WHERE e.timesheet_id = $1 ORDER BY emp.full_name`,
    [req.params.id]
  );

  const entries = rows.map((r) => ({
    ...r,
    shift_data: typeof r.shift_data === 'string' ? JSON.parse(r.shift_data || '{}') : r.shift_data,
    absence_data: typeof r.absence_data === 'string' ? JSON.parse(r.absence_data || '[]') : r.absence_data,
  }));

  res.json({ timesheet: ts[0], entries });
});

router.put('/:id/entries', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { entries } = req.body;
  const { rows: ts } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [req.params.id]);
  if (!ts[0]) return res.status(404).json({ error: 'Табель не найден' });
  if (ts[0].status === 'approved') return res.status(400).json({ error: 'Табель утверждён' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== ts[0].unit_id) return res.status(403).json({ error: 'Нет доступа' });

  const days = getDaysInMonth(ts[0].year, ts[0].month);

  for (const entry of entries) {
    const shiftData = { ...(entry.shift_data || {}) };
    for (let d = 1; d <= days; d++) {
      const key = dayKey(d);
      if (shiftData[key] === undefined || shiftData[key] === null) {
        shiftData[key] = ts[0].schedule_type_snapshot === 'flexible' ? 0 : '';
      }
    }
    const hours = calcHoursFromShiftData(shiftData, ts[0].schedule_type_snapshot);
    if (ts[0].schedule_type_snapshot === 'flexible') {
      shiftData.total_hours = hours;
    }
    await query(
      `UPDATE ${timesheetEntries} SET hours_worked = $1, shift_data = $2, absence_data = $3, notes = $4
       WHERE id = $5 AND timesheet_id = $6`,
      [hours, JSON.stringify(shiftData), JSON.stringify(entry.absence_data || []), entry.notes || null, entry.id, req.params.id]
    );
  }
  res.json({ ok: true });
});

router.post('/:id/submit', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  await query(`UPDATE ${timesheets} SET status = 'submitted' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/approve', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  await query(`UPDATE ${timesheets} SET status = 'approved', approved_by = $1, approved_at = $2 WHERE id = $3`, [req.user.id, new Date().toISOString(), req.params.id]);
  res.json({ ok: true });
});

export default router;
