import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees, units, auditLog } from '../db/tables.js';
import { requireAuth, requireRoles, scopeByUnit } from '../middleware/auth.js';

const router = Router();

const LIST_FIELDS = `
  e.id, e.full_name, e.birth_date, e.employee_number, e.unit_id, e.position,
  e.employment_type, e.salary, e.hourly_rate, e.hire_date, e.probation_end_date,
  e.phone, e.telegram_username, e.emergency_contact, e.status, e.created_at,
  e.vacation_days_balance, e.staff_category
`;

const WRITABLE_FIELDS = [
  'full_name', 'birth_date', 'iin', 'unit_id', 'position', 'employment_type',
  'salary', 'hourly_rate', 'hire_date', 'probation_end_date', 'phone',
  'telegram_username', 'emergency_contact', 'gender', 'citizenship', 'marital_status',
  'address', 'personal_email', 'work_email', 'id_document_number',
  'id_document_issued_by', 'id_document_issued_date', 'employee_number',
  'contract_number', 'termination_date', 'termination_reason', 'staff_category',
  'work_schedule', 'vacation_days_balance', 'education_level', 'education_specialty',
  'bank_name', 'bank_account', 'has_children', 'children_count', 'disability_group',
  'notes', 'status',
];

function sanitizeEmployee(row) {
  if (!row) return row;
  const employee = { ...row };
  employee.iin = employee.iin_encrypted || null;
  delete employee.iin_encrypted;
  return employee;
}

function parseBody(body) {
  const data = {};
  for (const field of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      data[field] = body[field];
    }
  }
  if (data.iin !== undefined) {
    data.iin_encrypted = data.iin || null;
    delete data.iin;
  }
  if (data.has_children !== undefined) {
    data.has_children = data.has_children ? 1 : 0;
  }
  if (data.vacation_days_balance !== undefined && data.vacation_days_balance !== null && data.vacation_days_balance !== '') {
    data.vacation_days_balance = Number(data.vacation_days_balance);
  }
  if (data.children_count !== undefined && data.children_count !== null && data.children_count !== '') {
    data.children_count = Number(data.children_count);
  }
  if (data.disability_group !== undefined && data.disability_group !== null && data.disability_group !== '') {
    data.disability_group = Number(data.disability_group);
  }
  if (data.salary !== undefined && data.salary !== null && data.salary !== '') {
    data.salary = Number(data.salary);
  }
  if (data.hourly_rate !== undefined && data.hourly_rate !== null && data.hourly_rate !== '') {
    data.hourly_rate = Number(data.hourly_rate);
  }
  return data;
}

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
    const raw = String(filters.search).trim();
    const variants = [...new Set([
      raw,
      raw.toLocaleLowerCase('ru-RU'),
      raw.charAt(0).toUpperCase() + raw.slice(1).toLocaleLowerCase('ru-RU'),
    ])];
    const parts = [];
    for (const v of variants) {
      const term = `%${v}%`;
      parts.push(
        `(e.full_name LIKE $${idx} OR e.employee_number LIKE $${idx + 1} OR e.position LIKE $${idx + 2})`
      );
      params.push(term, term, term);
      idx += 3;
    }
    conditions.push(`(${parts.join(' OR ')})`);
  }

  const sql = `
    SELECT ${LIST_FIELDS},
           u.name AS unit_name, u.code AS unit_code, u.unit_type
    FROM ${employees} e
    JOIN ${units} u ON u.id = e.unit_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.full_name
  `;

  return { sql, params };
}

router.get('/dictionaries/positions', requireAuth, requireRoles('admin', 'hr', 'finance', 'manager'), async (_req, res) => {
  const { rows } = await query(
    `SELECT DISTINCT position FROM ${employees} WHERE status = 'active' AND position IS NOT NULL AND TRIM(position) != ''
     ORDER BY position`
  );
  res.json({ positions: rows.map((r) => r.position) });
});

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

  res.json({ employee: sanitizeEmployee(rows[0]) });
});

function makeEmployeeNumber(unitId, fullName) {
  const slug = String(fullName).toLowerCase().replace(/[^a-zа-яё0-9]/gi, '').slice(0, 24);
  return `emp_${slug || 'new'}_${Date.now().toString(36)}`;
}

router.post('/', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const data = parseBody(req.body);

  if (!data.full_name || !data.unit_id || !data.position || !data.hire_date) {
    return res.status(400).json({
      error: 'Заполните обязательные поля: ФИО, подразделение, должность, дата приёма',
    });
  }

  if (!data.birth_date) data.birth_date = '1990-01-01';
  if (!data.employee_number) data.employee_number = makeEmployeeNumber(data.unit_id, data.full_name);

  const id = randomUUID();
  const fields = [
    'id', 'full_name', 'birth_date', 'iin_encrypted', 'unit_id', 'position', 'employment_type',
    'salary', 'hourly_rate', 'hire_date', 'probation_end_date', 'phone', 'telegram_username',
    'emergency_contact', 'gender', 'citizenship', 'marital_status', 'address', 'personal_email',
    'work_email', 'id_document_number', 'id_document_issued_by', 'id_document_issued_date',
    'employee_number', 'contract_number', 'staff_category', 'work_schedule',
    'vacation_days_balance', 'education_level', 'education_specialty', 'bank_name', 'bank_account',
    'has_children', 'children_count', 'disability_group', 'notes',
  ];

  const values = fields.map((f) => {
    if (f === 'id') return id;
    if (f === 'employment_type') return data.employment_type || 'full';
    return data[f] ?? null;
  });

  const placeholders = fields.map((_, i) => `$${i + 1}`).join(',');

  const driver = process.env.DB_DRIVER || 'mssql';
  const returning = driver === 'sqlite' ? ' RETURNING *' : '';
  const output = driver === 'sqlite' ? '' : ' OUTPUT INSERTED.*';

  const { rows } = await query(
    `INSERT INTO ${employees} (${fields.join(', ')})${output}
     VALUES (${placeholders})${returning}`,
    values
  );

  await query(
    `INSERT INTO ${auditLog} (id, user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'create', 'employee', $3, $4)`,
    [randomUUID(), req.user.id, rows[0].id, JSON.stringify({ full_name: data.full_name, unit_id: data.unit_id })]
  );

  res.status(201).json({ employee: sanitizeEmployee(rows[0]) });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const data = parseBody(req.body);
  const entries = Object.entries(data).filter(([key]) => key !== 'id');

  if (entries.length === 0) {
    return res.status(400).json({ error: 'Нет данных для обновления' });
  }

  const scopedUnitId = scopeByUnit(req);
  const checkParams = [req.params.id];
  let checkSql = `SELECT id, unit_id FROM ${employees} WHERE id = $1`;
  if (scopedUnitId) {
    checkSql += ' AND unit_id = $2';
    checkParams.push(scopedUnitId);
  }

  const { rows: existing } = await query(checkSql, checkParams);
  if (!existing[0]) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  const setClauses = entries.map(([key], i) => `${key} = $${i + 2}`);
  setClauses.push(`updated_at = $${entries.length + 2}`);

  const driver = process.env.DB_DRIVER || 'mssql';
  const updatedAt = new Date().toISOString();
  const params = [req.params.id, ...entries.map(([, v]) => v), updatedAt];
  const returning = driver === 'sqlite' ? ' RETURNING *' : '';
  const output = driver === 'sqlite' ? '' : ' OUTPUT INSERTED.*';

  const { rows } = await query(
    `UPDATE ${employees}
     SET ${setClauses.join(', ')}${output}
     WHERE id = $1${returning}`,
    params
  );

  await query(
    `INSERT INTO ${auditLog} (id, user_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, 'update', 'employee', $3, $4)`,
    [randomUUID(), req.user.id, req.params.id, JSON.stringify({ fields: entries.map(([k]) => k) })]
  );

  res.json({ employee: sanitizeEmployee(rows[0]) });
});

export default router;
