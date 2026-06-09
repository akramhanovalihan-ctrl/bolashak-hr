import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, onboardingTasks } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

const ONBOARD_TEMPLATE = [
  { title: 'Подписание трудового договора', responsible_role: 'hr' },
  { title: 'Инструктаж по ОТ и ТБ', responsible_role: 'manager' },
  { title: 'Выдача формы / рабочей одежды', responsible_role: 'manager' },
  { title: 'Создание учётных записей в системах', responsible_role: 'it' },
  { title: 'Добавление в Telegram-чат подразделения', responsible_role: 'manager' },
];

router.get('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const params = [];
  let sql = `
    SELECT t.*, e.full_name FROM ${onboardingTasks} t
    JOIN ${employees} e ON e.id = t.employee_id WHERE 1=1`;
  if (req.query.employee_id) { params.push(req.query.employee_id); sql += ` AND t.employee_id = $${params.length}`; }
  if (req.query.status) { params.push(req.query.status); sql += ` AND t.status = $${params.length}`; }
  sql += ' ORDER BY t.due_date, t.title';
  const { rows } = await query(sql, params);
  res.json({ tasks: rows });
});

router.post('/start', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { employee_id, task_type = 'onboard' } = req.body;
  const template = task_type === 'onboard' ? ONBOARD_TEMPLATE : [
    { title: 'Возврат формы и ключей', responsible_role: 'manager' },
    { title: 'Закрытие доступов в системах', responsible_role: 'it' },
    { title: 'Финальный расчёт', responsible_role: 'finance' },
  ];
  const hireDate = new Date();
  for (let i = 0; i < template.length; i++) {
    const due = new Date(hireDate);
    due.setDate(due.getDate() + i);
    await query(
      `INSERT INTO ${onboardingTasks} (id, employee_id, task_type, title, responsible_role, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [randomUUID(), employee_id, task_type, template[i].title, template[i].responsible_role, due.toISOString().slice(0, 10)]
    );
  }
  res.status(201).json({ created: template.length });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  await query(`UPDATE ${onboardingTasks} SET status = $1 WHERE id = $2`, [req.body.status || 'done', req.params.id]);
  res.json({ ok: true });
});

export default router;
