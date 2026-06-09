import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { advances, disciplinary, employees, payroll, timesheetEntries, timesheets, units } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';
import { buildDefaultShiftData, calcHoursFromShiftData } from '../utils/timesheet.js';

const router = Router();

function calcBaseSalary(emp, hoursWorked, hoursNorm, scheduleType) {
  const salary = Number(emp.salary) || 0;
  if (emp.employment_type === 'hourly') return (Number(emp.hourly_rate) || 0) * hoursWorked;
  if (emp.employment_type === 'contractor') return salary;
  if (!hoursNorm) return salary;
  return salary * (hoursWorked / hoursNorm);
}

async function syncTimesheetEmployees(ts, unit, year, month) {
  const { rows: emps } = await query(
    `SELECT id FROM ${employees} WHERE unit_id = $1 AND status = 'active'`,
    [unit.id]
  );
  const { rows: existing } = await query(
    `SELECT employee_id FROM ${timesheetEntries} WHERE timesheet_id = $1`,
    [ts.id]
  );
  const existingIds = new Set(existing.map((r) => r.employee_id));
  for (const emp of emps) {
    if (existingIds.has(emp.id)) continue;
    const shiftData = buildDefaultShiftData(year, month, unit.schedule_type);
    const hours = calcHoursFromShiftData(shiftData, unit.schedule_type);
    await query(
      `INSERT INTO ${timesheetEntries} (id, timesheet_id, employee_id, hours_worked, hours_norm, shift_data)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), ts.id, emp.id, hours, unit.hours_norm_default, JSON.stringify(shiftData)]
    );
  }
}

async function ensureTimesheet(unit, year, month) {
  const { rows: existing } = await query(
    `SELECT * FROM ${timesheets} WHERE unit_id = $1 AND year = $2 AND month = $3`,
    [unit.id, year, month]
  );
  if (existing[0]) {
    if (existing[0].status === 'draft') {
      await syncTimesheetEmployees(existing[0], unit, year, month);
    }
    return existing[0];
  }

  const tsId = randomUUID();
  await query(
    `INSERT INTO ${timesheets} (id, unit_id, year, month, schedule_type_snapshot, status)
     VALUES ($1,$2,$3,$4,$5,'draft')`,
    [tsId, unit.id, year, month, unit.schedule_type]
  );

  const { rows: emps } = await query(
    `SELECT id FROM ${employees} WHERE unit_id = $1 AND status = 'active'`,
    [unit.id]
  );

  for (const emp of emps) {
    const shiftData = buildDefaultShiftData(year, month, unit.schedule_type);
    const hours = calcHoursFromShiftData(shiftData, unit.schedule_type);
    await query(
      `INSERT INTO ${timesheetEntries} (id, timesheet_id, employee_id, hours_worked, hours_norm, shift_data)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), tsId, emp.id, hours, unit.hours_norm_default, JSON.stringify(shiftData)]
    );
  }

  const { rows } = await query(`SELECT * FROM ${timesheets} WHERE id = $1`, [tsId]);
  return rows[0];
}

async function syncPayrollForPeriod(year, month, unitId = null, scopedUnitId = null) {
  let unitsSql = `SELECT * FROM ${units} WHERE is_active = 1`;
  const unitParams = [];
  const filterUnit = scopedUnitId || unitId;
  if (filterUnit) {
    unitParams.push(filterUnit);
    unitsSql += ` AND id = $${unitParams.length}`;
  }
  const { rows: unitRows } = await query(unitsSql, unitParams);

  let count = 0;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  for (const unit of unitRows) {
    const ts = await ensureTimesheet(unit, year, month);

    const { rows: entries } = await query(
      `SELECT te.*, e.salary, e.hourly_rate, e.employment_type, e.full_name, e.position
       FROM ${timesheetEntries} te
       JOIN ${employees} e ON e.id = te.employee_id
       WHERE te.timesheet_id = $1`,
      [ts.id]
    );

    for (const ent of entries) {
      const { rows: fines } = await query(
        `SELECT COALESCE(SUM(deduction_amount),0) AS total FROM ${disciplinary}
         WHERE employee_id = $1 AND violation_date >= $2 AND violation_date < $3`,
        [ent.employee_id, monthStart, monthEnd]
      );
      const deductions = Number(fines[0]?.total) || 0;
      const hoursWorked = Number(ent.hours_worked) || 0;
      const hoursNorm = Number(ent.hours_norm) || Number(unit.hours_norm_default);
      const monthlySalary = Number(ent.salary) || 0;
      const base = calcBaseSalary(ent, hoursWorked, hoursNorm, ts.schedule_type_snapshot);

      const { rows: adv } = await query(
        `SELECT COALESCE(SUM(approved_amount),0) AS paid FROM ${advances}
         WHERE employee_id = $1 AND year = $2 AND month = $3 AND status IN ('approved','paid')`,
        [ent.employee_id, year, month]
      );
      const advancePaid = Number(adv[0]?.paid) || 0;

      const { rows: existing } = await query(
        `SELECT id, bonuses, manual_deductions FROM ${payroll}
         WHERE employee_id = $1 AND year = $2 AND month = $3`,
        [ent.employee_id, year, month]
      );

      const bonuses = Number(existing[0]?.bonuses) || 0;
      const manualDeductions = Number(existing[0]?.manual_deductions) || 0;
      const finalAmount = base - advancePaid - deductions - manualDeductions + bonuses;

      if (existing[0]) {
        await query(
          `UPDATE ${payroll}
           SET base_salary=$1, advance_paid=$2, deductions=$3, final_amount=$4, unit_id=$5,
               monthly_salary=$6, hours_norm=$7, hours_worked=$8
           WHERE id=$9`,
          [base, advancePaid, deductions, finalAmount, unit.id, monthlySalary, hoursNorm, hoursWorked, existing[0].id]
        );
      } else {
        await query(
          `INSERT INTO ${payroll}
           (id, employee_id, unit_id, year, month, base_salary, advance_paid, deductions,
            manual_deductions, bonuses, final_amount, monthly_salary, hours_norm, hours_worked)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,$9,$10,$11,$12)`,
          [randomUUID(), ent.employee_id, unit.id, year, month, base, advancePaid, deductions,
            finalAmount, monthlySalary, hoursNorm, hoursWorked]
        );
      }
      count += 1;
    }
  }

  return count;
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { year, month, unit_id } = req.query;
  const scoped = scopeByUnit(req);
  const params = [Number(year), Number(month)];
  let sql = `
    SELECT p.*, e.full_name, e.position, u.name AS unit_name,
           t.status AS timesheet_status
    FROM ${payroll} p
    JOIN ${employees} e ON e.id = p.employee_id
    JOIN ${units} u ON u.id = p.unit_id
    LEFT JOIN ${timesheets} t ON t.unit_id = p.unit_id AND t.year = p.year AND t.month = p.month
    WHERE p.year = $1 AND p.month = $2`;
  if (scoped) { params.push(scoped); sql += ` AND p.unit_id = $${params.length}`; }
  else if (unit_id) { params.push(unit_id); sql += ` AND p.unit_id = $${params.length}`; }
  sql += ' ORDER BY u.name, e.full_name';
  const { rows } = await query(sql, params);
  res.json({ payroll: rows });
});

router.post('/sync', requireAuth, requireRoles('admin', 'hr', 'finance'), async (req, res) => {
  const { year, month, unit_id } = req.body;
  const scoped = scopeByUnit(req);
  if (scoped && unit_id && scoped !== unit_id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const count = await syncPayrollForPeriod(year, month, unit_id || null, scoped);
  res.json({ synced: count });
});

router.post('/generate', requireAuth, requireRoles('admin', 'hr', 'finance'), async (req, res) => {
  const { year, month, unit_id } = req.body;
  const scoped = scopeByUnit(req);
  const count = await syncPayrollForPeriod(year, month, unit_id || null, scoped);
  res.json({ generated: count });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'finance'), async (req, res) => {
  const { bonuses, manual_deductions, notes } = req.body;
  const { rows } = await query(`SELECT * FROM ${payroll} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Не найдено' });
  const p = rows[0];
  const bonusesVal = bonuses ?? p.bonuses;
  const manualVal = manual_deductions ?? p.manual_deductions;
  const final = Number(p.base_salary) - Number(p.advance_paid) - Number(p.deductions) - Number(manualVal) + Number(bonusesVal);
  await query(
    `UPDATE ${payroll} SET bonuses=$1, manual_deductions=$2, final_amount=$3, notes=$4 WHERE id=$5`,
    [bonusesVal, manualVal, final, notes ?? p.notes, req.params.id]
  );
  const { rows: updated } = await query(
    `SELECT p.*, e.full_name, e.position, u.name AS unit_name
     FROM ${payroll} p
     JOIN ${employees} e ON e.id = p.employee_id
     JOIN ${units} u ON u.id = p.unit_id
     WHERE p.id = $1`,
    [req.params.id]
  );
  res.json({ payroll: updated[0] });
});

router.get('/advances', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { year, month } = req.query;
  const { rows } = await query(
    `SELECT a.*, e.full_name, u.name AS unit_name FROM ${advances} a
     JOIN ${employees} e ON e.id = a.employee_id JOIN ${units} u ON u.id = a.unit_id
     WHERE a.year = $1 AND a.month = $2 ORDER BY e.full_name`,
    [Number(year), Number(month)]
  );
  res.json({ advances: rows });
});

router.post('/advances', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { employee_id, unit_id, year, month, requested_amount } = req.body;
  const { rows: emp } = await query(`SELECT salary FROM ${employees} WHERE id = $1`, [employee_id]);
  const maxAllowed = (Number(emp[0]?.salary) || 0) * 0.5;
  if (requested_amount > maxAllowed) {
    return res.status(400).json({ error: `Лимит 50%: макс. ${Math.round(maxAllowed)} ₸`, max_allowed: maxAllowed });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO ${advances} (id, employee_id, unit_id, year, month, requested_amount, max_allowed, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
    [id, employee_id, unit_id, year, month, requested_amount, maxAllowed]
  );
  res.status(201).json({ ok: true, max_allowed: maxAllowed });
});

router.patch('/advances/:id', requireAuth, requireRoles('admin', 'finance'), async (req, res) => {
  const { status, approved_amount } = req.body;
  await query(
    `UPDATE ${advances} SET status = $1, approved_amount = $2 WHERE id = $3`,
    [status, approved_amount, req.params.id]
  );
  res.json({ ok: true });
});

export default router;
