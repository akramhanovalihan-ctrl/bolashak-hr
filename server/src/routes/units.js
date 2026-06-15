import { Router } from 'express';
import { query } from '../db/index.js';
import { users, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/managers/candidates', requireAuth, requireRoles('admin', 'hr'), async (_req, res) => {
  const { rows } = await query(
    `SELECT id, full_name, email, role
     FROM ${users}
     WHERE is_active = 1 AND role IN ('admin', 'hr', 'manager')
     ORDER BY full_name`
  );

  res.json({ candidates: rows });
});

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.code, u.name, u.unit_type, u.schedule_type,
            u.hours_norm_default, u.is_active, u.telegram_chat_id,
            u.manager_user_id, m.full_name AS manager_name
     FROM ${units} u
     LEFT JOIN ${users} m ON m.id = u.manager_user_id
     WHERE u.is_active = 1
     ORDER BY u.unit_type, u.name`
  );

  res.json({ units: rows });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { manager_user_id } = req.body;

  if (manager_user_id) {
    const { rows: managerRows } = await query(
      `SELECT id FROM ${users}
       WHERE id = $1 AND is_active = 1 AND role IN ('admin', 'hr', 'manager')`,
      [manager_user_id]
    );
    if (!managerRows[0]) {
      return res.status(400).json({ error: 'Выберите действующего руководителя из списка пользователей' });
    }
  }

  const { rows } = await query(
    `UPDATE ${units}
     SET manager_user_id = $1
     OUTPUT INSERTED.*
     WHERE id = $2`,
    [manager_user_id || null, req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Подразделение не найдено' });
  }

  const { rows: enriched } = await query(
    `SELECT u.id, u.code, u.name, u.unit_type, u.schedule_type,
            u.hours_norm_default, u.is_active, u.telegram_chat_id,
            u.manager_user_id, m.full_name AS manager_name
     FROM ${units} u
     LEFT JOIN ${users} m ON m.id = u.manager_user_id
     WHERE u.id = $1`,
    [req.params.id]
  );

  res.json({ unit: enriched[0] });
});

router.get('/:id', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.*, m.full_name AS manager_name
     FROM ${units} u
     LEFT JOIN ${users} m ON m.id = u.manager_user_id
     WHERE u.id = $1`,
    [req.params.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Подразделение не найдено' });
  }

  res.json({ unit: rows[0] });
});

export default router;
