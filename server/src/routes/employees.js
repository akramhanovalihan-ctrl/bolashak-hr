import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, units, auditLog } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';

const router = Router();

function buildEmployeeQuery(filters, scopedUnitId) {
  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (scopedUnitId) {
    conditions.push(`e.unit_id = $${idx++}`);
    params.push(scopedUnitId);
  }

  if (filters.unit_id) {
    conditions.push(`e.unit_id = $${idx++}`);
    params.push(filters.unit_id);
  }

  if (filters.status) {
    conditions.push(`e.status = $${idx++}`);
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push(`e.full_name LIKE $${idx++}`);
    params.push(`%${filters.search}%`);
  }

  const sql = `
    SELECT e.id, e.full_name, e.birth_date, e.unit_id, e.position,
           e.employment_type, e.salary, e.hourly_rate, e.hire_date,
           e.probation_end_date, e.phone, e.telegram_username,
           e.emergency_contact, e.status, e.created_at,
           u.name AS unit_name, u.code AS unit_code, u.unit_type
    FROM ${employees} e
    JOIN ${units} u ON u.id = e.unit_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.full_name
  `;

  return { sql, params };
}

router.get('/', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const scopedUnitId = scopeByUnit(req);
  const { sql, params } = buildEmployeeQuery(
    {
      unit_id: req.query.unit_id,
      status: req.query.status || 'active',
      search: req.query.search,
    },
    scopedUnitId
  );

  const { rows } = await query(sql, params);
  res.json({ employees: rows });
});

router.get('/:id', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (req, res) => {
  const scopedUnitId = scopeByUnit(req);
  const params = [req.params.id];
  let sql = `
    SELECT e.*, u.name AS unit_name, u.code AS unit_code
    FROM ${employees} e
    JOIN ${units} u ON u.id = e.unit_id
    WHERE e.id = $1
  `;

  if (scopedUnitId) {
    sql += ' AND e.unit_id = $2';
    params.push(scopedUnitId);
  }

  const { rows } = await query(sql, params);

  if (!rows[0]) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  const employee = { ...rows[0] };
  delete employee.iin_encrypted;
  res.json({ employee });
});

router.post('/', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const {
    full_name,
    birth_date,
    unit_id,
    position,
    employment_type = 'full',
    salary,
    hourly_rate,
    hire_date,
    probation_end_date,
    phone,
    telegram_username,
    emergency_contact,
  } = req.body;

  if (!full_name || !unit_id || !position || !hire_date) {
    return res.status(400).json({ error: 'Заполните обязательные поля: ФИО, подразделение, должность, дата приёма' });
  }

  const id = randomUUID();

  const { rows } = await query(
    `INSERT INTO ${employees} (
       id, full_name, birth_date, unit_id, position, employment_type,
       salary, hourly_rate, hire_date, probation_end_date,
       phone, telegram_username, emergency_contact
     )
     OUTPUT INSERTED.*
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      full_name,
      birth_date || null,
      unit_id,
      position,
      employment_type,
      salary || null,
      hourly_rate || null,
      hire_date,
      probation_end_date || null,
      phone || null,
      telegram_username || null,
      emergency_contact || null,
    ]
  );

  await query(
    `INSERT INTO ${auditLog} (id, user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'create', 'employee', $3, $4)`,
    [randomUUID(), req.user.id, rows[0].id, JSON.stringify({ full_name, unit_id, position })]
  );

  res.status(201).json({ employee: rows[0] });
});

export default router;
