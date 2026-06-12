import { randomUUID } from 'crypto';
import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { query } from '../db/index.js';
import { documents, employees, units, users } from '../db/tables.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { documentVisibleToUser, notifyUsers, resolveVisibilityAudience } from '../services/notify.js';
import { getUploadsDir, storedFileName, storedFilePath } from '../utils/uploads.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadsDir()),
    filename: (req, file, cb) => cb(null, storedFileName(req.params.id, file.originalname)),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|png|jpe?g|txt)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Допустимы: PDF, Word, Excel, PNG, JPG, TXT'));
  },
});

async function userContext(userId) {
  const { rows } = await query(
    `SELECT u.id, u.role, u.unit_id, u.job_title, u.employee_id, e.position, e.unit_id AS employee_unit_id
     FROM ${users} u LEFT JOIN ${employees} e ON e.id = u.employee_id WHERE u.id = $1`,
    [userId]
  );
  return rows[0];
}

router.get('/', requireAuth, async (req, res) => {
  const ctx = await userContext(req.user.id);
  const params = [];
  let sql = `
    SELECT d.*, e.full_name, u.name AS unit_name, cu.full_name AS created_by_name
    FROM ${documents} d
    LEFT JOIN ${employees} e ON e.id = d.employee_id
    LEFT JOIN ${units} u ON u.id = d.unit_id
    LEFT JOIN ${users} cu ON cu.id = d.created_by WHERE 1=1`;

  if (req.query.employee_id) {
    params.push(req.query.employee_id);
    sql += ` AND d.employee_id = $${params.length}`;
  }
  sql += ' ORDER BY d.created_at DESC';

  const { rows } = await query(sql, params);
  const filtered = rows.filter((d) => documentVisibleToUser(d, { ...ctx, id: req.user.id }, ctx?.employee_id));
  res.json({ documents: filtered });
});

router.post('/', requireAuth, requireRoles('admin', 'hr', 'manager'), async (req, res) => {
  const { employee_id, unit_id, doc_type, title, content, file_name, visibility } = req.body;
  if (!title?.trim() || !doc_type) {
    return res.status(400).json({ error: 'Укажите тип и название документа' });
  }
  const id = randomUUID();
  const visJson = visibility ? JSON.stringify(visibility) : JSON.stringify({ mode: 'all' });
  await query(
    `INSERT INTO ${documents}
     (id, employee_id, unit_id, doc_type, title, content, file_name, status, visibility, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9)`,
    [id, employee_id || null, unit_id || null, doc_type, title.trim(), content || null, file_name || null, visJson, req.user.id]
  );
  res.status(201).json({ ok: true, id });
});

router.post('/:id/publish', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { rows } = await query(`SELECT * FROM ${documents} WHERE id = $1`, [req.params.id]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Документ не найден' });

  const visibility = req.body.visibility
    ? JSON.stringify(req.body.visibility)
    : (doc.visibility || JSON.stringify({ mode: 'all' }));

  await query(
    `UPDATE ${documents}
     SET status = 'published', visibility = $1, published_by = $2, published_at = $3
     WHERE id = $4`,
    [visibility, req.user.id, new Date().toISOString(), req.params.id]
  );

  const audience = await resolveVisibilityAudience(visibility);
  await notifyUsers(audience, {
    title: `Новый документ: ${doc.title}`,
    body: `Опубликован документ «${doc.title}». Откройте раздел «Документы».`,
    link: '/documents',
  });

  res.json({ ok: true });
});

router.patch('/:id', requireAuth, requireRoles('admin', 'hr'), async (req, res) => {
  const { title, content, visibility } = req.body;
  const sets = [];
  const params = [req.params.id];
  if (title) { params.push(title); sets.push(`title = $${params.length}`); }
  if (content !== undefined) { params.push(content); sets.push(`content = $${params.length}`); }
  if (visibility) { params.push(JSON.stringify(visibility)); sets.push(`visibility = $${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Нет данных' });
  await query(`UPDATE ${documents} SET ${sets.join(', ')} WHERE id = $1`, params);
  res.json({ ok: true });
});

async function assertDocAccess(req, res) {
  const { rows } = await query(`SELECT * FROM ${documents} WHERE id = $1`, [req.params.id]);
  const doc = rows[0];
  if (!doc) {
    res.status(404).json({ error: 'Документ не найден' });
    return null;
  }
  const ctx = await userContext(req.user.id);
  if (!documentVisibleToUser(doc, { ...ctx, id: req.user.id }, ctx?.employee_id)) {
    res.status(403).json({ error: 'Нет доступа' });
    return null;
  }
  return doc;
}

function handleUploadError(err, _req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Файл слишком большой (макс. 15 МБ)' });
  }
  if (err?.message?.includes('Допустимы')) {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}

 router.put('/:id/file', requireAuth, requireRoles('admin', 'hr', 'manager'), (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  const { rows } = await query(`SELECT id FROM ${documents} WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Документ не найден' });
  if (!req.file) return res.status(400).json({ error: 'Выберите файл' });
  await query(`UPDATE ${documents} SET file_name = $1 WHERE id = $2`, [req.file.originalname, req.params.id]);
  res.json({ ok: true, file_name: req.file.originalname });
});

// GET /:id/download — скачать вложение
 router.get('/:id/download', requireAuth, async (req, res) => {
  const doc = await assertDocAccess(req, res);
  if (!doc) return;
  if (!doc.file_name) return res.status(404).json({ error: 'Файл не прикреплён' });
  const filePath = storedFilePath(doc.id, doc.file_name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден на сервере' });
  }
  res.download(filePath, doc.file_name);
});

export default router;
