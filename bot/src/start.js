import './env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { Telegraf } from 'telegraf';
import { registerStart, registerLinkFallback } from './handlers/start.js';
import { registerEmployee } from './handlers/employee.js';
import { registerManager } from './handlers/manager.js';
import { registerHr } from './handlers/hr.js';
import { registerAdmin } from './handlers/admin.js';
import { registerCallbacks } from './handlers/callbacks.js';
import { registerUnknownCommandHint } from './commands.js';
import { registerMenuRouter, registerBotCommands, sendRoleMenu } from './menu.js';
import { startCronJobs } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  registerMenuRouter(bot);
  registerUnknownCommandHint(bot);

  bot.help(async (ctx) => {
    const { getContextByTelegram, commandsForRole } = await import('./auth.js');
    const c = await getContextByTelegram(ctx.from.id);
    if (!c) {
      return ctx.reply('Сначала /start — привязка к базе HR.');
    }
    await ctx.reply(`@BolashakHR_bot — команды:\n${commandsForRole(c.role).join('\n')}`);
    await sendRoleMenu(ctx, c.role);
  });

  botInstance = bot;

  await bot.launch({ dropPendingUpdates: true }, async () => {
    await registerBotCommands(bot);
    startCronJobs(bot);
    console.log('Bolashak HR Bot запущен (long polling) → @BolashakHR_bot');
  });

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
