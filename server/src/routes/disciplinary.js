import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { disciplinary, employees, units, users } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';

const router = Router();

const VIOLATIONS = {
  LATE_S: { label: 'Опоздание до 30 мин', amount: 500 },
  LATE_L: { label: 'Опоздание более 30 мин', amount: 1000 },
  ABSENT: { label: 'Прогул', amount: 0 },
  DRESS: { label: 'Дресс-код', amount: 300 },
  SERVICE: { label: 'Стандарты обслуживания', amount: 0 },
  SHORTAGE: { label: 'Недостача', amount: 0 },
  OTHER: { label: 'Другое', amount: 0 },
};

router.get('/types', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), (_req, res) => res.json({ types: VIOLATIONS }));

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const scoped = scopeByUnit(req);
  const params = [];
  let sql = `
    SELECT d.*, e.full_name, u.name AS unit_name, ru.full_name AS recorded_by_name
    FROM ${disciplinary} d
    JOIN ${employees} e ON e.id = d.employee_id
    JOIN ${units} u ON u.id = d.unit_id
    LEFT JOIN ${users} ru ON ru.id = d.recorded_by WHERE 1=1`;
  if (scoped) { params.push(scoped); sql += ` AND d.unit_id = $${params.length}`; }
  sql += ' ORDER BY d.violation_date DESC';
  const { rows } = await query(sql, params);
  res.json({ violations: rows });
});

router.post('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { employee_id, unit_id, violation_type, violation_date, deduction_amount, description } = req.body;
  const scoped = scopeByUnit(req);
  if (scoped && scoped !== unit_id) {
    return res.status(403).json({ error: 'Нет доступа к этому подразделению' });
  }
  const preset = VIOLATIONS[violation_type];
  const amount = deduction_amount ?? preset?.amount ?? 0;
  const id = randomUUID();
  await query(
    `INSERT INTO ${disciplinary} (id, employee_id, unit_id, violation_type, violation_date, deduction_amount, description, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, employee_id, unit_id, violation_type, violation_date, amount, description || null, req.user.id]
  );
  res.status(201).json({ ok: true });
});

export default router;
