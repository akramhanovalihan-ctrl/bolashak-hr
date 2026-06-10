import { query } from '../../server/src/db/index.js';
import { employees, users, units } from '../../server/src/db/tables.js';

export function normalizePhone(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d;
}

export async function findEmployeeByPhone(phone) {
  const norm = normalizePhone(phone);
  const { rows } = await query(
    `SELECT e.*, u.name AS unit_name FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id WHERE e.status = 'active'`
  );
  return rows.find((e) => normalizePhone(e.phone) === norm) || null;
}

export async function findEmployeeByNumber(employeeNumber) {
  const num = String(employeeNumber || '').trim().toUpperCase();
  const { rows } = await query(
    `SELECT e.*, u.name AS unit_name FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id
     WHERE e.status = 'active' AND UPPER(e.employee_number) = $1`,
    [num]
  );
  return rows[0] || null;
}

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
}

export async function findEmployeeByName(input) {
  const raw = String(input || '').trim();
  if (raw.length < 3) return null;
  const norm = normalizeName(raw);
  const { rows } = await query(
    `SELECT e.*, u.name AS unit_name FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id WHERE e.status = 'active'`
  );

  let match = rows.find((e) => normalizeName(e.full_name) === norm);
  if (!match) {
    match = rows.find((e) => {
      const en = normalizeName(e.full_name);
      return en.includes(norm) || norm.includes(en);
    });
  }
  if (!match) {
    const tokens = raw.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length) {
      const candidates = rows.filter((e) => {
        const en = e.full_name.toLowerCase();
        return tokens.every((t) => en.includes(t));
      });
      if (candidates.length === 1) match = candidates[0];
    }
  }
  return match || null;
}

export async function linkTelegram(employeeId, telegramId, username) {
  await query(
    `UPDATE ${employees} SET telegram_id = $1, telegram_username = $2 WHERE id = $3`,
    [String(telegramId), username || null, employeeId]
  );
}

export async function completeEmployeeLink(employeeId, telegramId, username, phone) {
  await linkTelegram(employeeId, telegramId, username);
  if (phone) {
    await query(`UPDATE ${employees} SET phone = $1 WHERE id = $2`, [phone, employeeId]);
  }
  const { rows: emp } = await query(`SELECT full_name FROM ${employees} WHERE id = $1`, [employeeId]);
  if (emp[0]) {
    await query(
      `UPDATE ${users} SET employee_id = $1
       WHERE employee_id IS NULL AND lower(trim(full_name)) = lower(trim($2))`,
      [employeeId, emp[0].full_name]
    );
  }
}

export async function getContextByTelegram(telegramId) {
  const { rows } = await query(
    `SELECT e.*, u.name AS unit_name, un.manager_user_id
     FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id
     LEFT JOIN ${units} un ON un.id = e.unit_id
     WHERE e.telegram_id = $1 AND e.status = 'active'`,
    [String(telegramId)]
  );
  const emp = rows[0];
  if (!emp) return null;

  const { rows: userRows } = await query(
    `SELECT id, role, unit_id FROM ${users} WHERE employee_id = $1 AND is_active = 1`,
    [emp.id]
  );
  let role = userRows[0]?.role || 'employee';

  const { rows: managed } = await query(
    `SELECT id FROM ${units} WHERE manager_user_id IN (
      SELECT id FROM ${users} WHERE employee_id = $1
    )`,
    [emp.id]
  );
  if (managed.length && role === 'employee') role = 'manager';

  return {
    employee: emp,
    role,
    userId: userRows[0]?.id || null,
    unitId: emp.unit_id,
    managedUnits: managed.map((u) => u.id),
  };
}

export function roleLabel(role) {
  return { admin: 'ИД', hr: 'HR', manager: 'Директор', employee: 'Сотрудник', finance: 'Финансы' }[role] || role;
}

export function commandsForRole(role) {
  const base = ['/tabel', '/zp', '/grafik', '/otsutstvie', '/moi_zayavki'];
  if (role === 'manager') return [...base, '/tabel_magazin', '/onboarding'];
  if (role === 'hr') return [...base, '/noviy_sotrudnik', '/onboarding_vse', '/opros', '/tekuchka'];
  if (role === 'admin') return [...base, '/dashboard', '/vse_sotrudniki', '/noviy_sotrudnik', '/onboarding_vse', '/opros', '/tekuchka', '/tabel_magazin', '/onboarding'];
  return base;
}
