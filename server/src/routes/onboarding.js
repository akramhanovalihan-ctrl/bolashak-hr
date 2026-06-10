import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, onboardingTasks, onboardingTemplates, users } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { startOnboardingForEmployee } from '../services/onboarding-start.js';
import { notifyRoles } from '../services/notify.js';

const router = Router();

router.get('/templates', requireAuth, requireRoles('admin', 'hr'), async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM ${onboardingTemplates} ORDER BY task_type, sort_order, title`
  );
  res.json({ templates: rows });
});

router.post('/templates', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { task_type, title, responsible_role, sort_order } = req.body;
  if (!task_type || !title?.trim()) {
    return res.status(400).json({ error: 'Укажите тип и название задачи' });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO ${onboardingTemplates} (id, task_type, title, responsible_role, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,1)`,
    [id, task_type, title.trim(), responsible_role || null, sort_order || 0]
  );
  res.status(201).json({ ok: true, id });
});

router.delete('/templates/:id', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  await query(`UPDATE ${onboardingTemplates} SET is_active = 0 WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

router.get('/', requireAuth, async (req, res) => {
  const params = [];
  let sql = `
    SELECT t.*, e.full_name FROM ${onboardingTasks} t
    JOIN ${employees} e ON e.id = t.employee_id WHERE 1=1`;

  if (req.user.role === 'employee') {
    const { rows: u } = await query(
      `SELECT employee_id FROM ${users} WHERE id = $1`,
      [req.user.id]
    );
    if (!u[0]?.employee_id) return res.json({ tasks: [] });
    params.push(u[0].employee_id);
    sql += ` AND t.employee_id = $${params.length}`;
  } else {
    if (req.query.employee_id) {
      params.push(req.query.employee_id);
      sql += ` AND t.employee_id = $${params.length}`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      sql += ` AND t.status = $${params.length}`;
    }
  }

  sql += ' ORDER BY t.due_date, t.title';
  const { rows } = await query(sql, params);
  res.json({ tasks: rows });
});

router.post('/start', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { employee_id, task_type = 'onboard' } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'Укажите сотрудника' });

  const { rows: emp } = await query(`SELECT hire_date FROM ${employees} WHERE id = $1`, [employee_id]);
  const hireDate = emp[0]?.hire_date ? new Date(emp[0].hire_date) : new Date();
  const created = await startOnboardingForEmployee(employee_id, task_type, hireDate);

  await notifyRoles(['manager', 'hr'], {
    title: task_type === 'offboard' ? 'Запущен офбординг' : 'Запущен онбординг',
    body: `Создан чеклист из ${created} задач. Проверьте раздел «Онбординг».`,
    link: '/onboarding',
  });

  res.status(201).json({ created });
});

router.patch('/:id', requireAuth, async (req, res) => {
  const canManage = ['admin', 'hr', 'manager'].includes(req.user.role);
  if (!canManage && req.user.role === 'employee') {
    const { rows: u } = await query(`SELECT employee_id FROM ${users} WHERE id = $1`, [req.user.id]);
    const { rows: task } = await query(`SELECT employee_id FROM ${onboardingTasks} WHERE id = $1`, [req.params.id]);
    if (!u[0]?.employee_id || task[0]?.employee_id !== u[0].employee_id) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
  } else if (!canManage) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  await query(
    `UPDATE ${onboardingTasks} SET status = $1 WHERE id = $2`,
    [req.body.status || 'done', req.params.id]
  );
  res.json({ ok: true });
});

export default router;
