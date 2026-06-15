import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';
import { query } from '../db/index.js';
import { employees } from '../db/tables.js';
import { requireAuth } from '../middleware/auth.js';
import { extractOrgChartData } from '../db/parse-org-chart.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findOrgChartHtml() {
  const candidates = [
    path.join(__dirname, '../../../bolashak-org-base/bolashak_org_chart.html'),
    path.join(__dirname, '../../bolashak-org-base/bolashak_org_chart.html'),
    path.join(process.cwd(), 'bolashak-org-base/bolashak_org_chart.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function countNodes(node) {
  if (!node) return { total: 0, ft: 0, pt: 0, outsource: 0, vacancy: 0 };
  let stats = { total: 0, ft: 0, pt: 0, outsource: 0, vacancy: 0 };
  const isVacancy = /вакансия/i.test(node.name || '') || node.vacancy;
  if (node.name && node.type !== 'head' && !isVacancy && !node.children?.some((c) => c.role?.includes('сотрудник'))) {
    if (isVacancy) stats.vacancy++;
    else if (node.outsource) stats.outsource++;
    else {
      stats.total++;
      if (node.ft === false) stats.pt++;
      else stats.ft++;
    }
  }
  if (isVacancy) stats.vacancy++;
  for (const child of node.children || []) {
    const sub = countNodes(child);
    stats.total += sub.total;
    stats.ft += sub.ft;
    stats.pt += sub.pt;
    stats.outsource += sub.outsource;
    stats.vacancy += sub.vacancy;
  }
  return stats;
}

router.get('/', requireAuth, async (_req, res) => {
  const htmlPath = findOrgChartHtml();
  if (!htmlPath) {
    return res.status(404).json({ error: 'Файл оргструктуры не найден' });
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const tree = extractOrgChartData(html);
  const stats = countNodes(tree);

  const active = process.env.DB_DRIVER === 'sqlite' ? 'active' : 'active';
  const { rows: dbCount } = await query(
    `SELECT COUNT(*) AS count FROM ${employees} WHERE status = $1`,
    [active]
  );

  res.json({
    tree,
    stats: {
      ...stats,
      db_employees: dbCount[0]?.count || 0,
    },
  });
});

export default router;
