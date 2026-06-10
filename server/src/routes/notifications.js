import { Router } from 'express';
import { query } from '../db/index.js';
import { notifications } from '../db/tables.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const { rows } = await query(
    `SELECT * FROM ${notifications}
     WHERE user_id = $1 ORDER BY is_read ASC, created_at DESC LIMIT $2`,
    [req.user.id, limit]
  );
  const { rows: unread } = await query(
    `SELECT COUNT(*) AS count FROM ${notifications} WHERE user_id = $1 AND is_read = 0`,
    [req.user.id]
  );
  res.json({ notifications: rows, unread_count: unread[0]?.count || 0 });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  await query(
    `UPDATE ${notifications} SET is_read = 1 WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, async (req, res) => {
  await query(
    `UPDATE ${notifications} SET is_read = 1 WHERE user_id = $1 AND is_read = 0`,
    [req.user.id]
  );
  res.json({ ok: true });
});

export default router;
