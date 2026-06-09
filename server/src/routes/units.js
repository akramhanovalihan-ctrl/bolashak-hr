import { Router } from 'express';
import { query } from '../db/index.js';
import { users, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (_req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.code, u.name, u.unit_type, u.schedule_type,
            u.hours_norm_default, u.is_active, u.telegram_chat_id,
            m.full_name AS manager_name
     FROM ${units} u
     LEFT JOIN ${users} m ON m.id = u.manager_user_id
     WHERE u.is_active = 1
     ORDER BY u.unit_type, u.name`
  );

  res.json({ units: rows });
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
