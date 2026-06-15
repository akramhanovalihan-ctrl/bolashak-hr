import { getContextByTelegram, commandsForRole, roleLabel } from './auth.js';
import { getSession } from './session.js';
import { Markup } from 'telegraf';
import {
  handleTabel, handleZp, handleGrafik, handleOtsutstvie, handleMoiZayavki,
} from './handlers/employee.js';
import { handleTabelMagazin, handleOnboarding } from './handlers/manager.js';
import {
  handleNoviySotrudnik, handleOnboardingVse, handleOpros, handleTekuchka,
} from './handlers/hr.js';
import { handleDashboard, handleVseSotrudniki } from './handlers/admin.js';

const EMPLOYEE = [
  ['📅 Табель', '💰 ЗП'],
  ['🔄 График', '📝 Отсутствие'],
  ['📋 Мои заявки', '❓ Помощь'],
];

const MANAGER_EXTRA = [
  ['🏪 Табель отдела', '👋 Онбординг'],
];

const HR_EXTRA = [
  ['🆕 Новый сотрудник', '📋 Онбординг все'],
  ['📊 Пульс-опрос', '📉 Текучка'],
];

const ADMIN_EXTRA = [
  ['📊 Дашборд', '👥 Все сотрудники'],
];

export const MENU_HANDLERS = {
  '📅 Табель': handleTabel,
  '💰 ЗП': handleZp,
  '🔄 График': handleGrafik,
  '📝 Отсутствие': handleOtsutstvie,
  '📋 Мои заявки': handleMoiZayavki,
  '🏪 Табель отдела': handleTabelMagazin,
  '👋 Онбординг': handleOnboarding,
  '🆕 Новый сотрудник': handleNoviySotrudnik,
  '📋 Онбординг все': handleOnboardingVse,
  '📊 Пульс-опрос': handleOpros,
  '📉 Текучка': handleTekuchka,
  '📊 Дашборд': handleDashboard,
  '👥 Все сотрудники': handleVseSotrudniki,
};

function rowsForRole(role) {
  const rows = [...EMPLOYEE];
  if (['manager', 'hr', 'admin'].includes(role)) {
    rows.push(...MANAGER_EXTRA);
  }
  if (['hr', 'admin'].includes(role)) {
    rows.push(...HR_EXTRA);
  }
  if (role === 'admin') {
    rows.push(...ADMIN_EXTRA);
  }
  return rows;
}

export function menuKeyboard(role = 'employee') {
  return Markup.keyboard(rowsForRole(role)).resize().persistent();
}

export async function sendRoleMenu(ctx, role) {
  await ctx.reply(
    `Меню · ${roleLabel(role)}\nВыберите кнопку ниже или /help`,
    menuKeyboard(role),
  );
}

const BOT_COMMANDS = [
  { command: 'start', description: 'Регистрация / меню' },
  { command: 'menu', description: 'Показать кнопки меню' },
  { command: 'help', description: 'Список команд' },
  { command: 'tabel', description: 'Мой табель' },
  { command: 'zp', description: 'Моя зарплата' },
  { command: 'grafik', description: 'График смен' },
  { command: 'otsutstvie', description: 'Заявка на отсутствие' },
  { command: 'moi_zayavki', description: 'Мои заявки' },
  { command: 'tabel_magazin', description: 'Табель подразделения' },
  { command: 'onboarding', description: 'Онбординг' },
  { command: 'noviy_sotrudnik', description: 'Новый сотрудник (HR)' },
  { command: 'onboarding_vse', description: 'Онбординг все (HR)' },
  { command: 'opros', description: 'Пульс-опрос (HR)' },
  { command: 'tekuchka', description: 'Текучка (HR)' },
  { command: 'dashboard', description: 'HR-дашборд (ИД)' },
  { command: 'vse_sotrudniki', description: 'Все сотрудники (ИД)' },
];

export async function registerBotCommands(bot) {
  try {
    await bot.telegram.setMyCommands(BOT_COMMANDS);
  } catch (err) {
    console.warn('setMyCommands:', err.message);
  }
}

export function registerMenuRouter(bot) {
  for (const [label, handler] of Object.entries(MENU_HANDLERS)) {
    bot.hears(label, async (ctx, next) => {
      const session = getSession(ctx.from.id);
      if (session.flow) return next();
      return handler(ctx);
    });
  }

  bot.hears('❓ Помощь', async (ctx) => {
    const linked = await getContextByTelegram(ctx.from.id);
    if (!linked) {
      return ctx.reply('Сначала /start — привязка к базе HR.');
    }
    await ctx.reply(`Команды:\n${commandsForRole(linked.role).join('\n')}`);
  });

  bot.command('menu', async (ctx) => {
    const linked = await getContextByTelegram(ctx.from.id);
    if (!linked) {
      return ctx.reply('Сначала /start — привязка к базе HR.');
    }
    await sendRoleMenu(ctx, linked.role);
  });
}
