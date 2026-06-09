import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { advances, disciplinary, employees, payroll, timesheetEntries, timesheets, units } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';

const router = Router();

function calcBaseSalary(emp, hoursWorked, hoursNorm, scheduleType) {
  const salary = Number(emp.salary) || 0;
  if (emp.employment_type === 'hourly') return (Number(emp.hourly_rate) || 0) * hoursWorked;
  if (emp.employment_type === 'contractor') return salary;
  if (!hoursNorm) return salary;
  if (scheduleType === 'standard_5_2') return salary * (hoursWorked / hoursNorm);
  return salary * (hoursWorked / hoursNorm);
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { year, month, unit_id } = req.query;
  const scoped = scopeByUnit(req);
  const params = [Number(year), Number(month)];
  let sql = `
    SELECT p.*, e.full_name, e.position, u.name AS unit_name
    FROM ${payroll} p
    JOIN ${employees} e ON e.id = p.employee_id
    JOIN ${units} u ON u.id = p.unit_id
    WHERE p.year = $1 AND p.month = $2`;
  if (scoped) { params.push(scoped); sql += ` AND p.unit_id = $${params.length}`; }
  else if (unit_id) { params.push(unit_id); sql += ` AND p.unit_id = $${params.length}`; }
  sql += ' ORDER BY u.name, e.full_name';
  const { rows } = await query(sql, params);
  res.json({ payroll: rows });
});

router.post('/generate', requireAuth, requireRoles('admin', 'hr', 'finance'), async (req, res) => {
  const { year, month, unit_id } = req.body;
  const tsFilter = unit_id ? ` AND t.unit_id = '${unit_id}'` : '';
  const { rows: approved } = await query(
    `SELECT t.id, t.unit_id, t.schedule_type_snapshot FROM ${timesheets} t
     WHERE t.year = $1 AND t.month = $2 AND t.status = 'approved'${unit_id ? ' AND t.unit_id = $3' : ''}`,
    unit_id ? [year, month, unit_id] : [year, month]
  );

  let count = 0;
  for (const ts of approved) {
    const { rows: entries } = await query(
      `SELECT te.*, e.salary, e.hourly_rate, e.employment_type
       FROM ${timesheetEntries} te JOIN ${employees} e ON e.id = te.employee_id
       WHERE te.timesheet_id = $1`,
      [ts.id]
    );
    for (const ent of entries) {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const { rows: fines } = await query(
        `SELECT COALESCE(SUM(deduction_amount),0) AS total FROM ${disciplinary}
         WHERE employee_id = $1 AND violation_date >= $2 AND violation_date < $3`,
        [ent.employee_id, monthStart, monthEnd]
      );
      const deductions = Number(fines[0]?.total) || 0;
      const base = calcBaseSalary(ent, ent.hours_worked, ent.hours_norm, ts.schedule_type_snapshot);
      const { rows: adv } = await query(
        `SELECT COALESCE(SUM(approved_amount),0) AS paid FROM ${advances}
         WHERE employee_id = $1 AND year = $2 AND month = $3 AND status IN ('approved','paid')`,
        [ent.employee_id, year, month]
      );
      const advancePaid = Number(adv[0]?.paid) || 0;
      const finalAmount = base - advancePaid - deductions;

      const existing = await query(
        `SELECT id FROM ${payroll} WHERE employee_id = $1 AND year = $2 AND month = $3`,
        [ent.employee_id, year, month]
      );
      if (existing.rows[0]) {
        await query(
          `UPDATE ${payroll} SET base_salary=$1, advance_paid=$2, deductions=$3, final_amount=$4, unit_id=$5 WHERE id=$6`,
          [base, advancePaid, deductions, finalAmount, ts.unit_id, existing.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO ${payroll} (id, employee_id, unit_id, year, month, base_salary, advance_paid, deductions, final_amount)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [randomUUID(), ent.employee_id, ts.unit_id, year, month, base, advancePaid, deductions, finalAmount]
        );
      }
      count++;
    }
  }
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
    [bonusesVal, manualVal, final, notes || p.notes, req.params.id]
  );
  res.json({ ok: true });
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
