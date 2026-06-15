import { query } from '../../server/src/db/index.js';
import { employees, users, units } from '../../server/src/db/tables.js';

export function normalizePhone(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return d;
}

const ACTIVE = () => (process.env.DB_DRIVER === 'sqlite' ? 1 : 1);

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');
}

function nameTokens(raw) {
  return raw.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
}

function namesMatch(a, b) {
  const left = String(a || '').toLowerCase().trim();
  const right = String(b || '').toLowerCase().trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const lt = nameTokens(left);
  const rt = nameTokens(right);
  if (lt.length && rt.length && lt.every((t) => right.includes(t))) return true;
  if (lt.length && rt.length && rt.every((t) => left.includes(t))) return true;
  return false;
}

const ROLE_PRIORITY = { admin: 1, hr: 2, finance: 3, manager: 4, employee: 5 };

function pickRole(candidates) {
  return candidates
    .map((r) => r.role)
    .filter(Boolean)
    .sort((a, b) => (ROLE_PRIORITY[a] || 99) - (ROLE_PRIORITY[b] || 99))[0];
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
  if (!match && tokens.length >= 2) {
    for (const token of [...tokens].reverse()) {
      const part = rows.filter((e) => {
        const en = e.full_name.toLowerCase();
        return en.split(/\s+/).some((w) => w === token || w.startsWith(token));
      });
      if (part.length === 1) { match = part[0]; break; }
    }
  }
  if (!match && tokens.length === 1) {
    const part = rows.filter((e) => {
      const en = e.full_name.toLowerCase();
      return en.split(/\s+/).some((w) => w === tokens[0]);
    });
    if (part.length === 1) match = part[0];
  }

  if (!match) {
    const { rows: hrUsers } = await query(
      `SELECT id, full_name, employee_id FROM ${users} WHERE is_active = $1`,
      [ACTIVE()]
    );
    const userHit = hrUsers.find((u) => namesMatch(u.full_name, raw));
    if (userHit?.employee_id) {
      match = rows.find((e) => e.id === userHit.employee_id) || null;
    }
    if (!match && userHit) {
      const byUser = rows.filter((e) => namesMatch(e.full_name, userHit.full_name));
      if (byUser.length === 1) match = byUser[0];
    }
  }

  return match || null;
}

export async function linkTelegram(employeeId, telegramId, username) {
  const tg = String(telegramId);
  await query(
    `UPDATE ${employees} SET telegram_id = NULL, telegram_username = NULL WHERE telegram_id = $1 AND id != $2`,
    [tg, employeeId]
  );
  await query(
    `UPDATE ${employees} SET telegram_id = $1, telegram_username = $2 WHERE id = $3`,
    [tg, username || null, employeeId]
  );
}

async function syncUserEmployeeLinks(employeeId, fullName) {
  const { rows: hrUsers } = await query(
    `SELECT id, full_name, employee_id FROM ${users} WHERE is_active = $1`,
    [ACTIVE()]
  );
  const parts = fullName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  for (const user of hrUsers) {
    if (user.employee_id) continue;
    const hit = namesMatch(user.full_name, fullName)
      || parts.some((p) => String(user.full_name).toLowerCase().trim() === p);
    if (hit) {
      await query(`UPDATE ${users} SET employee_id = $1 WHERE id = $2`, [employeeId, user.id]);
    }
  }
}

export async function completeEmployeeLink(employeeId, telegramId, username, phone) {
  await linkTelegram(employeeId, telegramId, username);
  if (phone) {
    await query(`UPDATE ${employees} SET phone = $1 WHERE id = $2`, [String(phone), employeeId]);
  }
  const { rows: emp } = await query(`SELECT full_name FROM ${employees} WHERE id = $1`, [employeeId]);
  if (!emp[0]) return;
  await syncUserEmployeeLinks(employeeId, emp[0].full_name);
}

async function resolveRoleForEmployee(emp, linkedUsers) {
  const direct = linkedUsers.find((u) => u.employee_id === emp.id);
  if (direct?.role) return direct.role;

  const { rows: hrUsers } = await query(
    `SELECT id, role, full_name, employee_id FROM ${users} WHERE is_active = $1`,
    [ACTIVE()]
  );
  const byName = hrUsers.filter((u) => namesMatch(u.full_name, emp.full_name));
  const role = pickRole(byName);
  if (role) return role;

  const parts = emp.full_name.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  for (const part of parts) {
    const hit = hrUsers.find((u) => String(u.full_name).toLowerCase().trim() === part);
    if (hit?.role) return hit.role;
  }

  const { rows: managed } = await query(
    `SELECT id FROM ${units} WHERE manager_user_id IN (
      SELECT id FROM ${users} WHERE employee_id = $1
    )`,
    [emp.id]
  );
  if (managed.length) return 'manager';

  return 'employee';
}

export async function getContextByTelegram(telegramId) {
  const { rows } = await query(
    `SELECT e.*, u.name AS unit_name
     FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id
     WHERE e.telegram_id = $1 AND e.status = 'active'`,
    [String(telegramId)]
  );
  const emp = rows[0];
  if (!emp) return null;

  const { rows: userRows } = await query(
    `SELECT id, role, unit_id FROM ${users} WHERE employee_id = $1 AND is_active = $2`,
    [emp.id, ACTIVE()]
  );
  const role = await resolveRoleForEmployee(emp, userRows);

  const { rows: managed } = await query(
    `SELECT id FROM ${units} WHERE manager_user_id IN (
      SELECT id FROM ${users} WHERE employee_id = $1
    )`,
    [emp.id]
  );

  return {
    employee: emp,
    role,
    userId: userRows[0]?.id || null,
    unitId: emp.unit_id,
    managedUnits: managed.map((u) => u.id),
  };
}

export function roleLabel(role) {
  return { admin: 'ИД', hr: 'HR', manager: 'Руководитель', employee: 'Сотрудник', finance: 'Финансы' }[role] || role;
}

export function commandsForRole(role) {
  const base = [
    '/tabel — мой табель',
    '/zp — зарплата',
    '/grafik — график смен',
    '/otsutstvie — отгул/отпуск',
    '/moi_zayavki — мои заявки',
  ];
  if (role === 'manager') return [...base, '/tabel_magazin — табель отдела', '/onboarding — онбординг'];
  const hrExtra = [
    '/noviy_sotrudnik — новый сотрудник',
    '/onboarding_vse — все онбординги',
    '/opros — пульс-опрос',
    '/tekuchka — текучка',
  ];
  if (role === 'hr') return [...base, ...hrExtra, '/tabel_magazin — табель отдела', '/onboarding — онбординг'];
  if (role === 'admin') return [...base, ...hrExtra, '/dashboard — дашборд', '/vse_sotrudniki — все сотрудники', '/tabel_magazin — табель отдела', '/onboarding — онбординг'];
  return base;
}
