import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, units, vacations } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
const TYPE_LABELS = { AL: 'Отпуск', SL: 'Больничный', UL: 'Без оплаты', EL: 'Учебный', ML: 'Декрет', BT: 'Командировка' };

router.get('/', requireAuth, async (req, res) => {
  const params = [];
  let sql = `
    SELECT v.*, e.full_name, u.name AS unit_name
    FROM ${vacations} v
    JOIN ${employees} e ON e.id = v.employee_id
    JOIN ${units} u ON u.id = v.unit_id WHERE 1=1`;
  if (req.query.status) { params.push(req.query.status); sql += ` AND v.status = $${params.length}`; }
  sql += ' ORDER BY v.date_from DESC';
  const { rows } = await query(sql, params);
  res.json({ vacations: rows, types: TYPE_LABELS });
});

router.post('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { employee_id, unit_id, type, date_from, date_to, days_count, reason } = req.body;
  const id = randomUUID();
  await query(
    `INSERT INTO ${vacations} (id, employee_id, unit_id, type, date_from, date_to, days_count, reason, created_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
    [id, employee_id, unit_id, type, date_from, date_to, days_count, reason || null, req.user.id]
  );
  res.status(201).json({ ok: true });
});

router.post('/:id/approve', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const status = req.user.role === 'manager' ? 'manager_ok' : 'approved';
  await query(`UPDATE ${vacations} SET status = $1 WHERE id = $2`, [status, req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/reject', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  await query(`UPDATE ${vacations} SET status = 'rejected' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
