import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, payroll, disciplinary, vacations, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', requireAuth, requireRoles('admin', 'hr', 'finance'), async (req, res) => {
  const { year, month } = req.query;
  const y = Number(year) || new Date().getFullYear();
  const m = Number(month) || new Date().getMonth() + 1;

  const { rows: headcount } = await query(
    `SELECT u.name, u.unit_type, COUNT(e.id) AS count
     FROM ${units} u LEFT JOIN ${employees} e ON e.unit_id = u.id AND e.status = 'active'
     GROUP BY u.id ORDER BY u.name`
  );

  const { rows: fot } = await query(
    `SELECT u.name, SUM(p.final_amount) AS total
     FROM ${payroll} p JOIN ${units} u ON u.id = p.unit_id
     WHERE p.year = $1 AND p.month = $2 GROUP BY u.id`,
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
    `SELECT COUNT(*) AS count FROM ${employees} WHERE status = 'active'`
  );

  const totalFot = fot.reduce((s, r) => s + Number(r.total || 0), 0);

  res.json({
    year: y,
    month: m,
    total_employees: totalEmployees[0]?.count || 0,
    total_fot: totalFot,
    headcount_by_unit: headcount,
    fot_by_unit: fot,
    violations_by_type: violations,
    pending_vacations: pendingVacations[0]?.count || 0,
  });
});

export default router;
