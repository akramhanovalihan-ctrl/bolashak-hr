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

function nameTokens(raw) {
  return raw.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
}

export async function findEmployeeByName(input) {
  const raw = String(input || '').trim();
  if (raw.length < 2) return null;
  const norm = normalizeName(raw);
  const tokens = nameTokens(raw);

  const { rows } = await query(
    `SELECT e.*, un.name AS unit_name FROM ${employees} e
     LEFT JOIN ${units} un ON un.id = e.unit_id WHERE e.status = 'active'`
  );

  let match = rows.find((e) => normalizeName(e.full_name) === norm);
  if (!match) {
    match = rows.find((e) => {
      const en = normalizeName(e.full_name);
      return en.includes(norm) || norm.includes(en);
    });
  }
  if (!match && tokens.length) {
    const candidates = rows.filter((e) => {
      const en = e.full_name.toLowerCase();
      return tokens.every((t) => en.includes(t));
    });
    if (candidates.length === 1) match = candidates[0];
  }
  // «Акрамханов Алихан» → сотрудник «Алихан» (если один в базе)
  if (!match && tokens.length >= 2) {
    for (const token of [...tokens].reverse()) {
      const part = rows.filter((e) => e.full_name.toLowerCase().includes(token));
      if (part.length === 1) { match = part[0]; break; }
    }
  }
  if (!match && tokens.length === 1) {
    const part = rows.filter((e) => e.full_name.toLowerCase().includes(tokens[0]));
    if (part.length === 1) match = part[0];
  }

  if (!match) {
    const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;
    const { rows: hrUsers } = await query(
      `SELECT id, full_name, employee_id FROM ${users} WHERE is_active = $1`,
      [active]
    );
    const userHit = hrUsers.find((u) => {
      const un = u.full_name.toLowerCase();
      return tokens.every((t) => un.includes(t) || raw.toLowerCase().includes(un))
        || un === raw.toLowerCase()
        || tokens.some((t) => un === t);
    });
    if (userHit?.employee_id) {
      match = rows.find((e) => e.id === userHit.employee_id) || null;
    }
    if (!match && userHit) {
      const byUser = rows.filter((e) => {
        const en = e.full_name.toLowerCase();
        const un = userHit.full_name.toLowerCase();
        return en.includes(un) || un.split(/\s+/).some((t) => en.includes(t));
      });
      if (byUser.length === 1) match = byUser[0];
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
  if (!emp[0]) return;

  const fullName = emp[0].full_name;
  const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;
  await query(
    `UPDATE ${users} SET employee_id = $1
     WHERE employee_id IS NULL AND is_active = $2 AND (
       lower(trim(full_name)) = lower(trim($3))
       OR lower($3) LIKE '%' || lower(trim(full_name)) || '%'
       OR lower(trim(full_name)) LIKE '%' || lower($3) || '%'
     )`,
    [employeeId, active, fullName]
  );

  const parts = fullName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const part of parts) {
    await query(
      `UPDATE ${users} SET employee_id = $1
       WHERE employee_id IS NULL AND is_active = $2
         AND lower(trim(full_name)) = lower($3)`,
      [employeeId, active, part]
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

  const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;
  const { rows: userRows } = await query(
    `SELECT id, role, unit_id FROM ${users} WHERE employee_id = $1 AND is_active = $2`,
    [emp.id, active]
  );
  let role = userRows[0]?.role;

  if (!role) {
    const { rows: byName } = await query(
      `SELECT role FROM ${users} WHERE is_active = $1 AND (
        lower(trim(full_name)) = lower(trim($2))
        OR lower($2) LIKE '%' || lower(trim(full_name)) || '%'
        OR lower(trim(full_name)) LIKE '%' || lower($2) || '%'
      ) ORDER BY CASE role
        WHEN 'admin' THEN 1 WHEN 'hr' THEN 2 WHEN 'finance' THEN 3
        WHEN 'manager' THEN 4 ELSE 5 END
      LIMIT 1`,
      [active, emp.full_name]
    );
    role = byName[0]?.role;
    const parts = emp.full_name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    if (!role && parts.length) {
      for (const part of parts) {
        const { rows: byPart } = await query(
          `SELECT role FROM ${users} WHERE is_active = $1 AND lower(trim(full_name)) = lower($2) LIMIT 1`,
          [active, part]
        );
        if (byPart[0]?.role) { role = byPart[0].role; break; }
      }
    }
  }
  if (!role) role = 'employee';

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
