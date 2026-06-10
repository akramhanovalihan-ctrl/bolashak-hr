import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { registerStart, registerLinkFallback } from './handlers/start.js';
import { registerEmployee } from './handlers/employee.js';
import { registerManager } from './handlers/manager.js';
import { registerHr } from './handlers/hr.js';
import { registerAdmin } from './handlers/admin.js';
import { registerCallbacks } from './handlers/callbacks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../server/.env') });

process.env.DB_DRIVER = process.env.DB_DRIVER || 'sqlite';
if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = path.join(__dirname, '../../server/data/bolashak_hr.db');
}

let botInstance = null;

export async function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('TELEGRAM_BOT_TOKEN не задан — бот не запущен');
    return null;
  }
  if (botInstance) return botInstance;

  await import('../../server/src/db/migrate.js').then((m) => m.runMigrations());

  const bot = new Telegraf(token);
  bot.catch((err, ctx) => {
    console.error('Bot error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    ctx.reply?.('Произошла ошибка. Попробуйте /start или позже.').catch(() => {});
  });

  registerEmployee(bot);
  registerManager(bot);
  registerHr(bot);
  registerAdmin(bot);
  registerCallbacks(bot);
  registerStart(bot);
  registerLinkFallback(bot);

  bot.help(async (ctx) => {
    const { getContextByTelegram, commandsForRole } = await import('./auth.js');
    const c = await getContextByTelegram(ctx.from.id);
    const cmds = c ? commandsForRole(c.role) : ['/start'];
    await ctx.reply(`@BolashakHRBot — команды:\n${cmds.join('\n')}`);
  });

  await bot.launch();
  botInstance = bot;
  console.log('Bolashak HR Bot запущен (long polling)');

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  return bot;
}

import { pathToFileURL } from 'url';
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  startBot().catch((err) => {
    console.error('Bot failed:', err);
    process.exit(1);
  });
}
