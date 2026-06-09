import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './index.js';
import { EMPLOYEES as FALLBACK_EMPLOYEES, UNITS, USERS } from './org-data.js';
import { loadAllSheetData, SHEETS_DIR } from './parse-sheets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const key = emp.key || `${emp.unit_code}_${emp.full_name}`;
  const existing = await query('SELECT id FROM hr_employees WHERE employee_number = $1', [key]);
  const salary = emp.salary || 200000;

  if (existing.rows[0]) {
    await query(
      `UPDATE hr_employees SET full_name=$1, unit_id=$2, position=$3, salary=$4, status='active'
       WHERE id=$5`,
      [emp.full_name, unitId, emp.position || 'Сотрудник', salary, existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  const id = randomUUID();
  await query(
    `INSERT INTO hr_employees (id, employee_number, full_name, birth_date, unit_id, position,
       employment_type, salary, hire_date, staff_category, status)
     VALUES ($1,$2,$3,$4,$5,$6,'full',$7,$8,$9,'active')`,
    [
      id, key, emp.full_name, emp.birth_date || '1990-01-01', unitId,
      emp.position || 'Сотрудник', salary, emp.hire_date || '2024-01-01',
      emp.staff_category || 'worker',
    ]
  );
  return id;
}

function getEmployeeSource() {
  if (fs.existsSync(SHEETS_DIR)) {
    try {
      const fromSheets = loadAllSheetData();
      if (fromSheets.length > 0) return fromSheets;
    } catch (err) {
      console.warn('Sheet import failed, using fallback:', err.message);
    }
  }
  return FALLBACK_EMPLOYEES;
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

  for (const unit of UNITS) {
    if (unit.manager && unitIds[unit.code] && userIds[unit.manager.email]) {
      await query('UPDATE hr_users SET unit_id = $1 WHERE email = $2', [unitIds[unit.code], unit.manager.email]);
    }
  }

  const employees = getEmployeeSource();
  let empCount = 0;
  for (const emp of employees) {
    const unitId = unitIds[emp.unit_code];
    if (!unitId) continue;
    await upsertEmployee(emp, unitId);
    empCount += 1;
  }

  console.log(`Org data: ${UNITS.length} units, ${Object.keys(userIds).length} users, ${empCount} employees (from sheets: ${fs.existsSync(SHEETS_DIR)})`);
}
