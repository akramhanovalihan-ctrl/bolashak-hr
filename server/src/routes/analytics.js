import { Router } from 'express';
import { query } from '../db/index.js';
import { sqlLimit } from '../db/sql-dialect.js';
import { employees, payroll, disciplinary, vacations, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

const VIOLATION_LABELS = {
  late: 'Опоздание',
  absent: 'Прогул',
  dress_code: 'Дресс-код',
  safety: 'Охрана труда',
  other: 'Прочее',
};

router.get('/dashboard', requireAuth, requireRoles('admin', 'hr', 'finance'), async (req, res, next) => {
  try {
  const { year, month } = req.query;
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;
  const active = process.env.DB_DRIVER === 'sqlite' ? 'active' : 'active';

  const { rows: headcount } = await query(
    `SELECT u.name, u.unit_type, COUNT(e.id) AS count
     FROM ${units} u LEFT JOIN ${employees} e ON e.unit_id = u.id AND e.status = $1
     GROUP BY u.id, u.name, u.unit_type ORDER BY u.name`,
    [active]
  );

  const { rows: fot } = await query(
    `SELECT u.name, SUM(p.final_amount) AS total
     FROM ${payroll} p JOIN ${units} u ON u.id = p.unit_id
     WHERE p.year = $1 AND p.month = $2 GROUP BY u.id, u.name`,
    [y, m]
  );

  const { rows: violations } = await query(
    `SELECT violation_type, COUNT(*) AS count FROM ${disciplinary}
     WHERE violation_date >= $1 AND violation_date < $2 GROUP BY violation_type`,
    [`${y}-01-01`, `${y + 1}-01-01`]
  );

  const { rows: pendingVacations } = await query(
    `SELECT COUNT(*) AS count FROM ${vacations} WHERE status IN ('pending','manager_ok')`
  );

  const { rows: totalEmployees } = await query(
    `SELECT COUNT(*) AS count FROM ${employees} WHERE status = $1`,
    [active]
  );

  const { rows: avgSalary } = await query(
    `SELECT AVG(salary) AS avg_salary FROM ${employees} WHERE status = $1 AND salary IS NOT NULL`,
    [active]
  );

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { rows: probationEnding } = await query(
    `SELECT full_name, position, probation_end_date FROM ${employees}
     WHERE status = $1 AND probation_end_date IS NOT NULL
       AND probation_end_date >= $2 AND probation_end_date <= $3
     ORDER BY probation_end_date ${sqlLimit(10)}`,
    [active, today, soonStr]
  );

  const totalFot = fot.reduce((s, r) => s + Number(r.total || 0), 0);

  res.json({
    year: y,
    month: m,
    total_employees: totalEmployees[0]?.count || 0,
    total_fot: totalFot,
    avg_salary: Number(avgSalary[0]?.avg_salary || 0),
    headcount_by_unit: headcount,
    fot_by_unit: fot,
    violations_by_type: violations.map((v) => ({
      ...v,
      label: VIOLATION_LABELS[v.violation_type] || v.violation_type,
    })),
    pending_vacations: pendingVacations[0]?.count || 0,
    probation_ending: probationEnding,
  });
  } catch (err) {
    next(err);
  }
});

export default router;
