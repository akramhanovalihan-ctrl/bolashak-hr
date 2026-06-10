import { randomUUID } from 'crypto';
import { query } from '../db/index.js';
import { notifications, users, employees } from '../db/tables.js';

async function sendEmail(to, subject, text) {
  const host = process.env.SMTP_HOST;
  if (!host || !to) return;
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'hr@bolashak.kz',
      to,
      subject,
      text,
    });
  } catch (err) {
    console.warn('Email send skipped:', err.message);
  }
}

export async function notifyUsers(userIds, { title, body, link, email = true }) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;

  for (const userId of unique) {
    await query(
      `INSERT INTO ${notifications} (id, user_id, title, body, link, is_read)
       VALUES ($1,$2,$3,$4,$5,0)`,
      [randomUUID(), userId, title, body || null, link || null]
    );
  }

  if (!email) return;

  const placeholders = unique.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await query(
    `SELECT id, email FROM ${users} WHERE id IN (${placeholders}) AND is_active = 1`,
    unique
  );
  for (const row of rows) {
    await sendEmail(row.email, title, [body, link].filter(Boolean).join('\n\n'));
  }
}

export async function notifyRoles(roles, payload) {
  if (!roles?.length) return;
  const placeholders = roles.map((_, i) => `$${i + 1}`).join(',');
  const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;
  const { rows } = await query(
    `SELECT id FROM ${users} WHERE role IN (${placeholders}) AND is_active = $${roles.length + 1}`,
    [...roles, active]
  );
  await notifyUsers(rows.map((r) => r.id), payload);
}

export async function resolveVisibilityAudience(visibility) {
  const v = typeof visibility === 'string' ? JSON.parse(visibility || '{}') : (visibility || {});
  const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;

  if (!v.mode || v.mode === 'all') {
    const { rows } = await query(
      `SELECT u.id FROM ${users} u WHERE u.is_active = $1`,
      [active]
    );
    return rows.map((r) => r.id);
  }

  if (v.mode === 'roles' && v.roles?.length) {
    const ph = v.roles.map((_, i) => `$${i + 2}`).join(',');
    const { rows } = await query(
      `SELECT id FROM ${users} WHERE is_active = $1 AND role IN (${ph})`,
      [active, ...v.roles]
    );
    return rows.map((r) => r.id);
  }

  if (v.mode === 'titles' && v.titles?.length) {
    const ph = v.titles.map((_, i) => `$${i + 2}`).join(',');
    const { rows } = await query(
      `SELECT DISTINCT u.id FROM ${users} u
       LEFT JOIN ${employees} e ON e.id = u.employee_id
       WHERE u.is_active = $1 AND (
         u.job_title IN (${ph}) OR e.position IN (${ph})
       )`,
      [active, ...v.titles, ...v.titles]
    );
    return rows.map((r) => r.id);
  }

  if (v.mode === 'units' && v.units?.length) {
    const ph = v.units.map((_, i) => `$${i + 2}`).join(',');
    const { rows } = await query(
      `SELECT DISTINCT u.id FROM ${users} u
       LEFT JOIN ${employees} e ON e.id = u.employee_id
       WHERE u.is_active = $1 AND (
         u.unit_id IN (${ph}) OR e.unit_id IN (${ph})
       )`,
      [active, ...v.units, ...v.units]
    );
    return rows.map((r) => r.id);
  }

  return [];
}

export function documentVisibleToUser(doc, user, employeeId) {
  if (['admin', 'hr'].includes(user.role)) return true;
  if (doc.created_by === user.id) return true;
  if (doc.employee_id && doc.employee_id === employeeId) return true;
  if (doc.status !== 'published') return false;

  const v = typeof doc.visibility === 'string'
    ? JSON.parse(doc.visibility || '{}')
    : (doc.visibility || {});

  if (!v.mode || v.mode === 'all') return true;
  if (v.mode === 'roles' && v.roles?.includes(user.role)) return true;
  if (v.mode === 'titles') {
    const title = user.job_title || user.position;
    if (title && v.titles?.includes(title)) return true;
  }
  if (v.mode === 'units' && v.units?.length) {
    const unit = user.unit_id || user.employee_unit_id;
    if (unit && v.units.includes(unit)) return true;
  }
  return false;
}
