import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, shiftSchedules, units } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';
import { getDaysInMonth } from '../utils/timesheet.js';

const router = Router();

async function assertScheduleAccess(req, scheduleId) {
  const { rows } = await query(`SELECT unit_id FROM ${shiftSchedules} WHERE id = $1`, [scheduleId]);
  if (!rows[0]) return { error: 'График не найден', status: 404 };
  const scoped = scopeByUnit(req);
  if (scoped && scoped !== rows[0].unit_id) {
    return { error: 'Нет доступа', status: 403 };
  }
  return { unit_id: rows[0].unit_id };
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { unit_id, year, month } = req.query;
  const scoped = scopeByUnit(req);
  const uid = scoped || unit_id;
  if (!uid) return res.status(400).json({ error: 'Укажите подразделение' });
  const { rows } = await query(
    `SELECT s.*, u.name AS unit_name FROM ${shiftSchedules} s JOIN ${units} u ON u.id = s.unit_id
     WHERE s.unit_id = $1 AND s.year = $2 AND s.month = $3`,
    [uid, Number(year), Number(month)]
  );
  const schedule = rows[0] || null;
  if (schedule?.schedule_data && typeof schedule.schedule_data === 'string') {
    schedule.schedule_data = JSON.parse(schedule.schedule_data);
  }
  res.json({ schedule });
});

router.post('/generate', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { unit_id, year, month } = req.body;
  const scoped = scopeByUnit(req);
  if (scoped && scoped !== unit_id) return res.status(403).json({ error: 'Нет доступа' });

  const { rows: unit } = await query(`SELECT schedule_type FROM ${units} WHERE id = $1`, [unit_id]);
  if (!['shift', 'shift_mixed'].includes(unit[0]?.schedule_type)) {
    return res.status(400).json({ error: 'График смен только для сменных подразделений' });
  }

  const { rows: emps } = await query(`SELECT id, full_name FROM ${employees} WHERE unit_id = $1 AND status = 'active'`, [unit_id]);
  const days = getDaysInMonth(year, month);
  const data = {};
  for (const emp of emps) {
    data[emp.id] = { name: emp.full_name, days: {} };
    for (let d = 1; d <= days; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      data[emp.id].days[String(d).padStart(2, '0')] = dow === 0 ? 'В' : 'Д';
    }
  }

  const existing = await query(`SELECT id FROM ${shiftSchedules} WHERE unit_id=$1 AND year=$2 AND month=$3`, [unit_id, year, month]);
  if (existing.rows[0]) {
    await query(`UPDATE ${shiftSchedules} SET schedule_data=$1 WHERE id=$2`, [JSON.stringify(data), existing.rows[0].id]);
    return res.json({ id: existing.rows[0].id });
  }
  const id = randomUUID();
  await query(
    `INSERT INTO ${shiftSchedules} (id, unit_id, year, month, schedule_data) VALUES ($1,$2,$3,$4,$5)`,
    [id, unit_id, year, month, JSON.stringify(data)]
  );
  res.status(201).json({ id });
});

router.put('/:id', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const access = await assertScheduleAccess(req, req.params.id);
  if (access.error) return res.status(access.status).json({ error: access.error });
  await query(`UPDATE ${shiftSchedules} SET schedule_data = $1 WHERE id = $2`, [JSON.stringify(req.body.schedule_data), req.params.id]);
  res.json({ ok: true });
});

router.post('/:id/publish', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const access = await assertScheduleAccess(req, req.params.id);
  if (access.error) return res.status(access.status).json({ error: access.error });
  await query(`UPDATE ${shiftSchedules} SET status = 'published' WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
