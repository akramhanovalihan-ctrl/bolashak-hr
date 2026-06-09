import { Router } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { users, units } from '../db/tables.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const activeCheck = process.env.DB_DRIVER === 'sqlite' ? '1' : '1';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }

  const { rows } = await query(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.unit_id, un.name AS unit_name
     FROM ${users} u
     LEFT JOIN ${units} un ON un.id = u.unit_id
     WHERE u.email = $1 AND u.is_active = ${activeCheck}`,
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
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
    },
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name, u.role, u.unit_id, un.name AS unit_name
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
