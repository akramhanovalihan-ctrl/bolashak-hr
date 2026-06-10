import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, users, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
const ROLES = ['admin', 'hr', 'finance', 'manager', 'employee'];

router.get('/', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { status } = req.query;
  let sql = `
    SELECT u.id, u.email, u.full_name, u.role, u.unit_id, u.job_title, u.employee_id,
           u.is_active, u.created_at, un.name AS unit_name, e.full_name AS employee_name
    FROM ${users} u
    LEFT JOIN ${units} un ON un.id = u.unit_id
    LEFT JOIN ${employees} e ON e.id = u.employee_id
    WHERE 1=1`;
  const params = [];
  if (status === 'pending') {
    sql += ` AND u.is_active = ${process.env.DB_DRIVER === 'sqlite' ? '0' : '0'}`;
  } else if (status === 'active') {
    sql += ` AND u.is_active = ${process.env.DB_DRIVER === 'sqlite' ? '1' : '1'}`;
  }
  sql += ' ORDER BY u.created_at DESC';
  const { rows } = await query(sql, params);
  res.json({ users: rows });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { is_active, role, unit_id, full_name, job_title, employee_id } = req.body;
  const { rows } = await query(`SELECT * FROM ${users} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });

  const updates = [];
  const params = [];
  let idx = 1;

  if (is_active !== undefined) {
    updates.push(`is_active = $${idx++}`);
    params.push(is_active ? (process.env.DB_DRIVER === 'sqlite' ? 1 : 1) : 0);
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Недопустимая роль' });
    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Только админ может назначать роль администратора' });
    }
    updates.push(`role = $${idx++}`);
    params.push(role);
  }
  if (unit_id !== undefined) {
    updates.push(`unit_id = $${idx++}`);
    params.push(unit_id || null);
  }
  if (full_name !== undefined) {
    updates.push(`full_name = $${idx++}`);
    params.push(full_name);
  }
  if (job_title !== undefined) {
    updates.push(`job_title = $${idx++}`);
    params.push(job_title || null);
  }
  if (employee_id !== undefined) {
    updates.push(`employee_id = $${idx++}`);
    params.push(employee_id || null);
    if (employee_id) {
      const { rows: emp } = await query(
        `SELECT full_name, position, unit_id FROM ${employees} WHERE id = $1`,
        [employee_id]
      );
      if (emp[0]) {
        if (full_name === undefined) {
          updates.push(`full_name = $${idx++}`);
          params.push(emp[0].full_name);
        }
        if (job_title === undefined) {
          updates.push(`job_title = $${idx++}`);
          params.push(emp[0].position);
        }
        if (unit_id === undefined) {
          updates.push(`unit_id = $${idx++}`);
          params.push(emp[0].unit_id);
        }
      }
    }
  }

  if (!updates.length) return res.status(400).json({ error: 'Нет данных для обновления' });

  params.push(req.params.id);
  await query(`UPDATE ${users} SET ${updates.join(', ')} WHERE id = $${idx}`, params);

  const { rows: updated } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.unit_id, u.job_title, u.employee_id,
            u.is_active, u.created_at, un.name AS unit_name, e.full_name AS employee_name
     FROM ${users} u
     LEFT JOIN ${units} un ON un.id = u.unit_id
     LEFT JOIN ${employees} e ON e.id = u.employee_id
     WHERE u.id = $1`,
    [req.params.id]
  );
  res.json({ user: updated[0] });
});

export default router;
