import { randomUUID } from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { users, units } from '../db/tables.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const activeCheck = process.env.DB_DRIVER === 'sqlite' ? '1' : '1';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(email) {
  const normalized = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalized)) return 'Введите корректный email';
  if (normalized.endsWith('@bolashak.local')) {
    return 'Используйте реальную почту (не @bolashak.local)';
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 8) return 'Пароль — минимум 8 символов';
  return null;
}

router.post('/register', async (req, res) => {
  const { email, password, password_confirm, full_name } = req.body;

  if (!full_name?.trim() || full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Укажите ФИО' });
  }

  const emailErr = validateEmail(email || '');
  if (emailErr) return res.status(400).json({ error: emailErr });

  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ error: passErr });

  if (password !== password_confirm) {
    return res.status(400).json({ error: 'Пароли не совпадают' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await query(`SELECT id FROM ${users} WHERE email = $1`, [normalizedEmail]);
  if (existing.rows[0]) {
    return res.status(409).json({ error: 'Этот email уже зарегистрирован' });
  }

  const hash = await bcrypt.hash(password, 12);
  const id = randomUUID();
  const inactive = process.env.DB_DRIVER === 'sqlite' ? 0 : 0;

  await query(
    `INSERT INTO ${users} (id, email, password_hash, full_name, role, is_active)
     VALUES ($1,$2,$3,$4,'employee',$5)`,
    [id, normalizedEmail, hash, full_name.trim(), inactive]
  );

  res.status(201).json({
    ok: true,
    message: 'Регистрация успешна. Администратор подтвердит доступ — после этого можно войти.',
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const { rows } = await query(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.unit_id, u.is_active,
            u.employee_id, u.job_title, un.name AS unit_name
     FROM ${users} u
     LEFT JOIN ${units} un ON un.id = u.unit_id
     WHERE u.email = $1`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const isActive = user.is_active === 1 || user.is_active === true;
  if (!isActive) {
    return res.status(403).json({
      error: 'Аккаунт ожидает подтверждения администратором. После одобрения вы сможете войти.',
    });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = signToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      unit_id: user.unit_id,
      unit_name: user.unit_name,
      employee_id: user.employee_id,
      job_title: user.job_title,
    },
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.unit_id, u.employee_id, u.job_title,
            un.name AS unit_name
     FROM ${users} u
     LEFT JOIN ${units} un ON un.id = u.unit_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  res.json({ user: rows[0] });
});

export default router;
