import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import unitsRoutes from './routes/units.js';
import employeesRoutes from './routes/employees.js';
import timesheetsRoutes from './routes/timesheets.js';
import payrollRoutes from './routes/payroll.js';
import vacationsRoutes from './routes/vacations.js';
import shiftsRoutes from './routes/shifts.js';
import onboardingRoutes from './routes/onboarding.js';
import disciplinaryRoutes from './routes/disciplinary.js';
import analyticsRoutes from './routes/analytics.js';
import documentsRoutes from './routes/documents.js';
import notificationsRoutes from './routes/notifications.js';
import orgChartRoutes from './routes/org-chart.js';
import portalRoutes from './routes/portal.js';
import { runMigrations } from './db/migrate.js';
import { importOrgData } from './db/import-org.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || !isProd) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'bolashak-hr',
    version: '2.1.3',
    build: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/hr/auth', authRoutes);
app.use('/api/hr/users', usersRoutes);
app.use('/api/hr/units', unitsRoutes);
app.use('/api/hr/employees', employeesRoutes);
app.use('/api/hr/timesheets', timesheetsRoutes);
app.use('/api/hr/payroll', payrollRoutes);
app.use('/api/hr/vacations', vacationsRoutes);
app.use('/api/hr/shifts', shiftsRoutes);
app.use('/api/hr/onboarding', onboardingRoutes);
app.use('/api/hr/disciplinary', disciplinaryRoutes);
app.use('/api/hr/analytics', analyticsRoutes);
app.use('/api/hr/documents', documentsRoutes);
app.use('/api/hr/notifications', notificationsRoutes);
app.use('/api/hr/org-chart', orgChartRoutes);
app.use('/api/hr/portal', portalRoutes);

app.get('/api/health/stats', (_req, res) => {
  res.json({ stats: global.__BOLASHAK_STATS || null });
});

if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

await runMigrations();

app.listen(PORT, HOST, () => {
  console.log(`Bolashak HR → http://${HOST}:${PORT} (${isProd ? 'production' : 'development'})`);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    import('../../bot/src/start.js')
      .then((m) => m.startBot())
      .catch((err) => console.error('Telegram bot failed:', err.message));
  }
});

importOrgData().catch((err) => {
  console.error('Org import failed:', err.message || err);
});
