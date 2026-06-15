import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, units, users, vacations } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';

const router = Router();
const TYPE_LABELS = { AL: 'Отпуск', SL: 'Больничный', UL: 'Без оплаты', EL: 'Учебный', ML: 'Декрет', BT: 'Командировка' };

async function getUserProfile(userId) {
  const { rows } = await query(
    `SELECT employee_id, unit_id FROM ${users} WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

router.get('/', requireAuth, async (req, res) => {
  const params = [];
  let sql = `
    SELECT v.*, e.full_name, u.name AS unit_name
    FROM ${vacations} v
    JOIN ${employees} e ON e.id = v.employee_id
    JOIN ${units} u ON u.id = v.unit_id WHERE 1=1`;

  const { role, id: userId } = req.user;

  if (role === 'employee') {
    const profile = await getUserProfile(userId);
    if (!profile?.employee_id) return res.json({ vacations: [], types: TYPE_LABELS });
    params.push(profile.employee_id);
    sql += ` AND v.employee_id = $${params.length}`;
  } else if (role === 'manager') {
    const scoped = scopeByUnit(req);
    if (scoped) {
      params.push(scoped);
      sql += ` AND v.unit_id = $${params.length}`;
    }
  }

  if (req.query.status) {
    params.push(req.query.status);
    sql += ` AND v.status = $${params.length}`;
  }
  sql += ' ORDER BY v.date_from DESC';
  const { rows } = await query(sql, params);
  res.json({ vacations: rows, types: TYPE_LABELS });
});

router.post('/', requireAuth, async (req, res) => {
  const { role, id: userId } = req.user;
  let { employee_id, unit_id, type, date_from, date_to, days_count, reason } = req.body;

  if (role === 'employee') {
    const profile = await getUserProfile(userId);
    if (!profile?.employee_id) {
      return res.status(400).json({ error: 'Профиль не привязан к сотруднику' });
    }
    employee_id = profile.employee_id;
    unit_id = profile.unit_id;
  } else if (!['admin', 'hr', 'manager'].includes(role)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  } else {
    const scoped = scopeByUnit(req);
    if (scoped && scoped !== unit_id) {
      return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
    }
  }

  if (!employee_id || !unit_id || !type || !date_from || !date_to) {
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  }

  const id = randomUUID();
  await query(
    `INSERT INTO ${vacations} (id, employee_id, unit_id, type, date_from, date_to, days_count, reason, created_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')`,
    [id, employee_id, unit_id, type, date_from, date_to, days_count || 1, reason || null, userId]
  );
  res.status(201).json({ ok: true, id });
});

router.post('/:id/approve', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { rows } = await query(`SELECT * FROM ${vacations} WHERE id = $1`, [req.params.id]);
  const vac = rows[0];
  if (!vac) return res.status(404).json({ error: 'Заявка не найдена' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== vac.unit_id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  let status;
  if (req.user.role === 'manager') {
    if (vac.status !== 'pending') return res.status(400).json({ error: 'Уже обработано' });
    status = 'manager_ok';
  } else {
    if (!['pending', 'manager_ok'].includes(vac.status)) {
      return res.status(400).json({ error: 'Уже обработано' });
    }
    status = 'approved';
  }

  await query(`UPDATE ${vacations} SET status = $1 WHERE id = $2`, [status, req.params.id]);
  res.json({ ok: true, status });
});

router.post('/:id/reject', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { rows } = await query(`SELECT * FROM ${vacations} WHERE id = $1`, [req.params.id]);
  const vac = rows[0];
  if (!vac) return res.status(404).json({ error: 'Заявка не найдена' });

  const scoped = scopeByUnit(req);
  if (scoped && scoped !== vac.unit_id) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  if (!['pending', 'manager_ok'].includes(vac.status)) {
    return res.status(400).json({ error: 'Уже обработано' });
  }

  await query(`UPDATE ${vacations} SET status = 'rejected' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
