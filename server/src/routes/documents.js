import { randomUUID } from 'crypto';
import { Router } from 'express';
import { query } from '../db/index.js';
import { documents, employees, units } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const params = [];
  let sql = `
    SELECT d.*, e.full_name, u.name AS unit_name
    FROM ${documents} d
    LEFT JOIN ${employees} e ON e.id = d.employee_id
    LEFT JOIN ${units} u ON u.id = d.unit_id WHERE 1=1`;
  if (req.query.employee_id) { params.push(req.query.employee_id); sql += ` AND d.employee_id = $${params.length}`; }
  sql += ' ORDER BY d.created_at DESC';
  const { rows } = await query(sql, params);
  res.json({ documents: rows });
});

router.post('/', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { employee_id, unit_id, doc_type, title, content, file_name } = req.body;
  const id = randomUUID();
  await query(
    `INSERT INTO ${documents} (id, employee_id, unit_id, doc_type, title, content, file_name, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, employee_id || null, unit_id || null, doc_type, title, content || null, file_name || null, req.user.id]
  );
  res.status(201).json({ ok: true, id });
});

export default router;
