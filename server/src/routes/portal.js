import { Router } from 'express';
import { query } from '../db/index.js';
import {
  users, employees, units, onboardingTasks, documents, vacations,
} from '../db/tables.js';
import { requireAuth } from '../middleware/auth.js';
import { documentVisibleToUser } from '../services/notify.js';

const router = Router();

async function loadUserContext(userId) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.unit_id, u.job_title, u.employee_id,
            un.name AS unit_name,
            e.position, e.hire_date, e.vacation_days_balance, e.unit_id AS employee_unit_id,
            eu.name AS employee_unit_name
     FROM ${users} u
     LEFT JOIN ${units} un ON un.id = u.unit_id
     LEFT JOIN ${employees} e ON e.id = u.employee_id
     LEFT JOIN ${units} eu ON eu.id = e.unit_id
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

router.get('/dashboard', requireAuth, async (req, res) => {
  const ctx = await loadUserContext(req.user.id);
  if (!ctx) return res.status(404).json({ error: 'Пользователь не найден' });

  const employeeId = ctx.employee_id;
  let onboarding = [];
  if (employeeId) {
    const { rows } = await query(
      `SELECT * FROM ${onboardingTasks} WHERE employee_id = $1 ORDER BY due_date, title`,
      [employeeId]
    );
    onboarding = rows;
  }

  const { rows: allDocs } = await query(
    `SELECT d.*, e.full_name, u.name AS unit_name
     FROM ${documents} d
     LEFT JOIN ${employees} e ON e.id = d.employee_id
     LEFT JOIN ${units} u ON u.id = d.unit_id
     ORDER BY d.created_at DESC`
  );

  const userForVis = {
    id: ctx.id,
    role: ctx.role,
    unit_id: ctx.unit_id,
    job_title: ctx.job_title,
    position: ctx.position,
    employee_unit_id: ctx.employee_unit_id,
  };
  const visibleDocs = allDocs.filter((d) => documentVisibleToUser(d, userForVis, employeeId));

  let vacationRequests = [];
  if (employeeId) {
    const { rows } = await query(
      `SELECT * FROM ${vacations} WHERE employee_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [employeeId]
    );
    vacationRequests = rows;
  }

  const pendingOnboarding = onboarding.filter((t) => t.status === 'pending').length;

  res.json({
    profile: {
      full_name: ctx.full_name,
      role: ctx.role,
      unit_name: ctx.employee_unit_name || ctx.unit_name,
      position: ctx.position || ctx.job_title,
      hire_date: ctx.hire_date,
      vacation_days_balance: ctx.vacation_days_balance,
    },
    onboarding,
    pending_onboarding: pendingOnboarding,
    documents: visibleDocs.slice(0, 10),
    vacation_requests: vacationRequests,
    company: {
      name: 'ТОО «Болашак»',
      tagline: 'HR-платформа · 19 подразделений',
    },
  });
});

export default router;
