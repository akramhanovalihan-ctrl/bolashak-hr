import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import { query } from './index.js';
import { EMPLOYEES, UNITS, USERS } from './org-data.js';

async function upsertUser(user, userIds) {
  const hash = await bcrypt.hash(user.password || 'mgr123', 12);
  const existing = await query('SELECT id FROM hr_users WHERE email = $1', [user.email]);
  if (existing.rows[0]) {
    await query(
      'UPDATE hr_users SET password_hash = $1, full_name = $2, role = $3 WHERE email = $4',
      [hash, user.full_name, user.role, user.email]
    );
    userIds[user.email] = existing.rows[0].id;
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await query(
    'INSERT INTO hr_users (id, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)',
    [id, user.email, hash, user.full_name, user.role]
  );
  userIds[user.email] = id;
  return id;
}

async function upsertUnit(unit, managerUserId, unitIds) {
  const existing = await query('SELECT id FROM hr_units WHERE code = $1', [unit.code]);
  if (existing.rows[0]) {
    await query(
      `UPDATE hr_units SET name=$1, unit_type=$2, schedule_type=$3,
              hours_norm_default=$4, manager_user_id=$5 WHERE code=$6`,
      [unit.name, unit.unit_type, unit.schedule_type, unit.hours_norm_default, managerUserId, unit.code]
    );
    unitIds[unit.code] = existing.rows[0].id;
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await query(
    `INSERT INTO hr_units (id, code, name, unit_type, schedule_type, hours_norm_default, manager_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, unit.code, unit.name, unit.unit_type, unit.schedule_type, unit.hours_norm_default, managerUserId]
  );
  unitIds[unit.code] = id;
  return id;
}

async function upsertEmployee(emp, unitId) {
  const existing = await query(
    'SELECT id FROM hr_employees WHERE employee_number = $1',
    [emp.key]
  );
  if (existing.rows[0]) {
    await query(
      `UPDATE hr_employees SET full_name=$1, birth_date=$2, unit_id=$3, position=$4,
              salary=$5, hire_date=$6, staff_category=$7, status='active' WHERE id=$8`,
      [emp.full_name, emp.birth_date, unitId, emp.position, emp.salary, emp.hire_date, emp.staff_category || 'specialist', existing.rows[0].id]
    );
    return existing.rows[0].id;
  }
  const id = randomUUID();
  await query(
    `INSERT INTO hr_employees (id, employee_number, full_name, birth_date, unit_id, position,
       employment_type, salary, hire_date, staff_category, status)
     VALUES ($1,$2,$3,$4,$5,$6,'full',$7,$8,$9,'active')`,
    [id, emp.key, emp.full_name, emp.birth_date, unitId, emp.position, emp.salary, emp.hire_date, emp.staff_category || 'specialist']
  );
  return id;
}

export async function importOrgData() {
  const userIds = {};
  const unitIds = {};

  for (const user of USERS) {
    await upsertUser(user, userIds);
  }

  for (const unit of UNITS) {
    if (unit.manager && !userIds[unit.manager.email]) {
      await upsertUser({ ...unit.manager, password: 'mgr123' }, userIds);
    }
    const managerId = unit.manager ? userIds[unit.manager.email] : null;
    await upsertUnit(unit, managerId, unitIds);
  }

  for (const user of USERS) {
    if (user.unit_code && unitIds[user.unit_code]) {
      await query('UPDATE hr_users SET unit_id = $1 WHERE email = $2', [unitIds[user.unit_code], user.email]);
    }
  }

  for (const mgr of UNITS.map((u) => u.manager).filter(Boolean)) {
    const unit = UNITS.find((u) => u.manager?.email === mgr.email);
    if (unit && unitIds[unit.code] && userIds[mgr.email]) {
      await query('UPDATE hr_users SET unit_id = $1 WHERE email = $2', [unitIds[unit.code], mgr.email]);
    }
  }

  let empCount = 0;
  for (const emp of EMPLOYEES) {
    const unitId = unitIds[emp.unit_code];
    if (!unitId) continue;
    await upsertEmployee(emp, unitId);
    empCount += 1;
  }

  console.log(`Org data: ${UNITS.length} units, ${Object.keys(userIds).length} users, ${empCount} employees`);
}
