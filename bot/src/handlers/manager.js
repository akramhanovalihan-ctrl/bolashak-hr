import { getContextByTelegram } from '../auth.js';
import { cmd } from '../commands.js';
import { getUnitTimesheet, getOnboardingForUnit } from '../queries.js';
import { onboardingTaskKeyboard } from '../keyboards.js';

async function requireManager(ctx) {
  const c = await getContextByTelegram(ctx.from.id);
  if (!c) { await ctx.reply('Сначала /start'); return null; }
  if (!['manager', 'admin', 'hr'].includes(c.role)) {
    await ctx.reply('Команда только для руководителей.');
    return null;
  }
  return c;
}

export async function handleTabelMagazin(ctx) {
  const c = await requireManager(ctx);
  if (!c) return;
  const unitId = c.role === 'manager' ? c.unitId : c.managedUnits[0] || c.unitId;
  const data = await getUnitTimesheet(unitId);
  if (!data) return ctx.reply('Табель магазина за месяц не создан.');
  const lines = data.entries.map((e) =>
    `${e.full_name}: ${e.hours_worked}/${e.hours_norm} ч`
  ).join('\n');
  await ctx.reply(
    `📅 Табель ${data.timesheet.unit_name}\n${data.month}/${data.year} · ${data.timesheet.status}\n\n${lines}`
  );
}

export async function handleOnboarding(ctx) {
  const c = await requireManager(ctx);
  if (!c) return;
  const unitId = c.unitId;
  const tasks = await getOnboardingForUnit(unitId);
  if (!tasks.length) return ctx.reply('Нет активных задач онбординга.');
  for (const t of tasks.slice(0, 8)) {
    await ctx.reply(
      `👤 ${t.full_name}\n☐ ${t.title} (до ${t.due_date})`,
      onboardingTaskKeyboard(t.id)
    );
  }
}

export function registerManager(bot) {
  cmd(bot, ['tabel_magazin', 'table_magazin', 'tabel_magasin'], handleTabelMagazin);
  cmd(bot, ['onboarding', 'onbording'], handleOnboarding);
}
