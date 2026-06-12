import { getContextByTelegram } from '../auth.js';
import { cmd } from '../commands.js';
import { parseDateRange } from '../gemini.js';
import { getSession, setSession, clearSession } from '../session.js';
import { leaveTypeKeyboard, confirmKeyboard } from '../keyboards.js';
import {
  getEmployeeTimesheet, getEmployeePayroll, getShiftSchedule,
  createVacationRequest, getEmployeeVacations, getManagerTelegramIds, getHrAdminTelegramIds,
  VAC_LABELS,
} from '../queries.js';

const LEAVE_NAMES = { day_off: 'Отгул', vacation: 'Отпуск', sick: 'Больничный', personal: 'Личное' };

async function requireAuth(ctx) {
  const c = await getContextByTelegram(ctx.from.id);
  if (!c) {
    await ctx.reply('Сначала /start и привязка телефона.');
    return null;
  }
  return c;
}

export function registerEmployee(bot) {
  cmd(bot, ['tabel', 'tabl'], async (ctx) => {
    const c = await requireAuth(ctx);
    if (!c) return;
    const t = await getEmployeeTimesheet(c.employee.id, c.unitId);
    const statusMap = { draft: 'Черновик', submitted: 'Сдан', approved: 'Утверждён', rejected: 'Отклонён' };
    const status = statusMap[t.status] || t.status;
    const extra = t.status === 'нет табеля'
      ? '\n\nТабель за этот месяц ещё не создан. Руководитель создаёт его в веб-приложении.'
      : '';
    await ctx.reply(
      `📅 Табель ${t.month}/${t.year}\n` +
      `Статус: ${status}\n` +
      `Часы: ${t.hours} / ${t.norm}${extra}`
    );
  });

  cmd(bot, 'zp', async (ctx) => {
    const c = await requireAuth(ctx);
    if (!c) return;
    const p = await getEmployeePayroll(c.employee.id);
    if (!p) return ctx.reply('Ведомость за текущий месяц ещё не сформирована.\n\nПопросите HR или руководителя: веб → «ЗП ведомость» → «Обновить» (нужен утверждённый табель).');
    await ctx.reply(
      `💰 ЗП за ${p.month}/${p.year}\n` +
      `Оклад: ${Number(p.base_salary || 0).toLocaleString('ru-RU')} ₸\n` +
      `Бонусы: +${Number(p.bonuses || 0).toLocaleString('ru-RU')} ₸\n` +
      `Удержания: -${Number(p.deductions || 0).toLocaleString('ru-RU')} ₸\n` +
      `Итого: ${Number(p.final_amount || 0).toLocaleString('ru-RU')} ₸`
    );
  });

  cmd(bot, ['grafik', 'grafic', 'график'], async (ctx) => {
    const c = await requireAuth(ctx);
    if (!c) return;
    const s = await getShiftSchedule(c.unitId);
    if (!s) return ctx.reply('График смен на этот месяц не опубликован.');
    const empData = s.data?.[c.employee.id];
    if (!empData?.days) return ctx.reply(`График (${s.status}): данных по вам нет.`);
    const days = Object.entries(empData.days).slice(0, 14)
      .map(([d, v]) => `${d}: ${v || '—'}`).join('\n');
    await ctx.reply(`🔄 График смен (первые 2 недели):\n${days}`);
  });

  cmd(bot, ['otsutstvie', 'otsustive', 'otsutstvye', 'отсутствие'], async (ctx) => {
    const c = await requireAuth(ctx);
    if (!c) return;
    setSession(ctx.from.id, { flow: 'leave', step: 'type' });
    await ctx.reply('Выберите тип отсутствия:', leaveTypeKeyboard);
  });

  cmd(bot, ['moi_zayavki', 'zayavki'], async (ctx) => {
    const c = await requireAuth(ctx);
    if (!c) return;
    const list = await getEmployeeVacations(c.employee.id);
    if (!list.length) return ctx.reply('Заявок пока нет.');
    const text = list.map((v) =>
      `${v.type_label}: ${v.date_from} — ${v.date_to}\nСтатус: ${v.status_label}`
    ).join('\n\n');
    await ctx.reply(`📋 Ваши заявки:\n\n${text}`);
  });

  bot.on('text', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (s.flow !== 'leave' || s.step !== 'dates') return next();

    const range = await parseDateRange(ctx.message.text);
    if (!range) return ctx.reply('Не понял даты. Введите, например: 11.06 или 10.06 — 12.06');

    setSession(ctx.from.id, { ...s, step: 'confirm', dateFrom: range.from, dateTo: range.to });
    await ctx.reply(
      `Запрос: ${LEAVE_NAMES[s.leaveType]} ${range.from}${range.from !== range.to ? ` — ${range.to}` : ''}\nОтправить?`,
      confirmKeyboard('leave')
    );
  });
}

export async function handleLeaveCallbacks(bot, ctx) {
  const data = ctx.callbackQuery.data;
  const tgId = ctx.from.id;

  if (data.startsWith('leave:') && !data.includes(':yes') && !data.includes(':no')) {
    const leaveType = data.split(':')[1];
    setSession(tgId, { flow: 'leave', step: 'dates', leaveType });
    await ctx.answerCbQuery();
    return ctx.reply('Введите дату или период (ДД.ММ или «завтра»):');
  }

  if (data === 'leave:yes') {
    const c = await getContextByTelegram(tgId);
    const s = getSession(tgId);
    if (!c || s.flow !== 'leave') return ctx.answerCbQuery('Сессия истекла');
    const req = await createVacationRequest({
      employeeId: c.employee.id,
      unitId: c.unitId,
      leaveType: s.leaveType,
      dateFrom: s.dateFrom,
      dateTo: s.dateTo,
    });
    clearSession(tgId);
    await ctx.answerCbQuery('Отправлено');
    await ctx.reply('✅ Заявка отправлена руководителю.');

    const managers = await getManagerTelegramIds(c.unitId);
    const msg = `📩 Запрос на ${LEAVE_NAMES[s.leaveType]}\n${c.employee.full_name}\n${s.dateFrom} — ${s.dateTo}`;
    const { vacationActionKeyboard } = await import('../keyboards.js');
    for (const mid of managers) {
      try {
        await bot.telegram.sendMessage(mid, msg, vacationActionKeyboard(req.id));
      } catch { /* manager not in bot */ }
    }
    const hrIds = await getHrAdminTelegramIds();
    const hrMsg = `📩 Новая заявка на отсутствие\n${c.employee.full_name}\n${LEAVE_NAMES[s.leaveType]} ${s.dateFrom} — ${s.dateTo}`;
    for (const hid of hrIds) {
      try {
        await bot.telegram.sendMessage(hid, hrMsg);
      } catch { /* */ }
    }
    return;
  }

  if (data === 'leave:no') {
    clearSession(tgId);
    await ctx.answerCbQuery('Отменено');
    return ctx.reply('Заявка отменена.');
  }
}
