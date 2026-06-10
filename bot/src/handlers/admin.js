import { getContextByTelegram } from '../auth.js';
import { getDashboardStats, listAllEmployees, getPulseSummary } from '../queries.js';

async function requireAdmin(ctx) {
  const c = await getContextByTelegram(ctx.from.id);
  if (!c) { await ctx.reply('Сначала /start'); return null; }
  if (c.role !== 'admin') {
    await ctx.reply('Команда только для ИД.');
    return null;
  }
  return c;
}

export function registerAdmin(bot) {
  bot.command('dashboard', async (ctx) => {
    const c = await requireAdmin(ctx);
    if (!c) return;
    const d = await getDashboardStats();
    const pulse = await getPulseSummary();
    const pulseLine = pulse.length
      ? pulse.map((p) => `${p.name}: ${Number(p.q1 || 0).toFixed(1)}/${Number(p.q2 || 0).toFixed(1)}/${Number(p.q3 || 0).toFixed(1)}`).join('\n')
      : 'нет данных';
    await ctx.reply(
      `📊 HR-дашборд\n\n` +
      `Штат: ${d.total_employees}\n` +
      `Открытые заявки: ${d.pending_vacations}\n` +
      `Онбординг (задачи): ${d.pending_onboarding}\n` +
      `Увольнения за квартал: ${d.terminated_quarter}\n\n` +
      `Пульс-опрос (средние):\n${pulseLine}`
    );
  });

  bot.command('vse_sotrudniki', async (ctx) => {
    const c = await requireAdmin(ctx);
    if (!c) return;
    const list = await listAllEmployees();
    const text = list.map((e) =>
      `${e.full_name} · ${e.unit_name || '—'} · ${e.position} · ${e.status}`
    ).join('\n');
    await ctx.reply(`👥 Сотрудники (до 50):\n\n${text}`);
  });
}
