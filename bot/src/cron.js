import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../../server/src/db/index.js';
import { employees, units } from '../../server/src/db/tables.js';
import { getHrAdminTelegramIds } from './queries.js';
import { broadcastPulseSurvey } from './services/pulse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '../../server/data/bot-cron-state.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function sendProbationReminders(telegram) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const { rows } = await query(
    `SELECT e.full_name, e.probation_end_date, u.name AS unit_name
     FROM ${employees} e
     LEFT JOIN ${units} u ON u.id = e.unit_id
     WHERE e.status = 'active' AND e.probation_end_date = $1`,
    [dateStr],
  );
  if (!rows.length) return 0;

  const hrIds = await getHrAdminTelegramIds();
  if (!hrIds.length) return 0;

  let sent = 0;
  const text = rows.map((e) =>
    `• ${e.full_name} (${e.unit_name || '—'}) — испытательный срок до ${e.probation_end_date}`,
  ).join('\n');

  for (const chatId of hrIds) {
    try {
      await telegram.sendMessage(
        chatId,
        `⏰ Напоминание HR\n\nЗавтра заканчивается испытательный срок:\n\n${text}`,
      );
      sent++;
    } catch {
      /* skip */
    }
  }
  return sent;
}

async function runScheduledJobs(bot) {
  const state = loadState();
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDate();
  const today = todayKey();
  const month = monthKey();

  if (day === 1 && hour === 10 && state.pulseMonth !== month) {
    const count = await broadcastPulseSurvey(bot.telegram);
    state.pulseMonth = month;
    state.lastPulseAt = new Date().toISOString();
    console.log(`[cron] Пульс-опрос: отправлено ${count} сотрудникам`);
  }

  if (hour === 9 && state.probationDay !== today) {
    const count = await sendProbationReminders(bot.telegram);
    state.probationDay = today;
    state.lastProbationAt = new Date().toISOString();
    if (count) console.log(`[cron] Напоминания об испытательном сроке: ${count} HR`);
  }

  saveState(state);
}

export function startCronJobs(bot) {
  const tick = () => runScheduledJobs(bot).catch((err) => {
    console.error('[cron] error:', err?.message || err);
  });
  tick();
  setInterval(tick, 60 * 60 * 1000);
  console.log('[cron] Планировщик: пульс-опрос 1-го числа 10:00, испытательный срок ежедневно 09:00');
}
