import { getContextByTelegram } from '../auth.js';
import { getSession, setSession, clearSession } from '../session.js';
import {
  getVacationById, approveVacation, rejectVacation,
  completeOnboardingTask, getHrAdminTelegramIds, VAC_LABELS,
} from '../queries.js';
import { handleLeaveCallbacks } from './employee.js';
import { handleNewEmpUnitCallback, handlePulseCallback } from './hr.js';

export function registerCallbacks(bot) {
  bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;

    if (data.startsWith('leave:')) return handleLeaveCallbacks(bot, ctx);
    if (data.startsWith('newemp_unit:')) return handleNewEmpUnitCallback(ctx);
    if (data.startsWith('pulse:')) return handlePulseCallback(ctx);

    if (data.startsWith('vac:approve:')) {
      const id = data.split(':')[2];
      const c = await getContextByTelegram(ctx.from.id);
      if (!c || !['manager', 'hr', 'admin'].includes(c.role)) {
        return ctx.answerCbQuery('Нет прав');
      }
      const vac = await getVacationById(id);
      if (!vac) return ctx.answerCbQuery('Не найдено');

      const { vacationActionKeyboard } = await import('../keyboards.js');

      if (c.role === 'manager') {
        if (vac.status !== 'pending') return ctx.answerCbQuery('Уже обработано');
        await approveVacation(id, 'manager');
        await ctx.answerCbQuery('Согласовано');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        if (vac.telegram_id) {
          await bot.telegram.sendMessage(
            vac.telegram_id,
            `✅ Заявка ${VAC_LABELS[vac.type] || vac.type} ${vac.date_from}—${vac.date_to} согласована руководителем. Ожидает подтверждения HR.`
          );
        }
        const hrIds = await getHrAdminTelegramIds();
        const msg = `📩 На согласование HR\n${vac.full_name}\n${VAC_LABELS[vac.type] || vac.type} ${vac.date_from}—${vac.date_to}`;
        for (const hid of hrIds) {
          try {
            await bot.telegram.sendMessage(hid, msg, vacationActionKeyboard(id));
          } catch { /* */ }
        }
        return;
      }

      if (!['pending', 'manager_ok'].includes(vac.status)) {
        return ctx.answerCbQuery('Уже обработано');
      }
      await approveVacation(id, 'hr');
      await ctx.answerCbQuery('Одобрено');
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      if (vac.telegram_id) {
        await bot.telegram.sendMessage(
          vac.telegram_id,
          `✅ Заявка ${VAC_LABELS[vac.type] || vac.type} ${vac.date_from}—${vac.date_to} одобрена.`
        );
      }
      return;
    }

    if (data.startsWith('vac:reject:')) {
      const id = data.split(':')[2];
      const c = await getContextByTelegram(ctx.from.id);
      if (!c || !['manager', 'hr', 'admin'].includes(c.role)) {
        return ctx.answerCbQuery('Нет прав');
      }
      setSession(ctx.from.id, { flow: 'reject_vac', vacationId: id });
      await ctx.answerCbQuery();
      return ctx.reply('Укажите причину отклонения (или «-»):');
    }

    if (data.startsWith('onb:done:')) {
      const taskId = data.split(':')[2];
      const c = await getContextByTelegram(ctx.from.id);
      if (!c || !['manager', 'hr', 'admin'].includes(c.role)) {
        return ctx.answerCbQuery('Нет прав');
      }
      await completeOnboardingTask(taskId);
      await ctx.answerCbQuery('Готово');
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

      const hrIds = await getHrAdminTelegramIds();
      for (const hid of hrIds) {
        try {
          await bot.telegram.sendMessage(hid, `✅ Задача онбординга выполнена (${c.employee.full_name})`);
        } catch { /* */ }
      }
    }
  });

  bot.on('text', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (s.flow !== 'reject_vac') return next();
    const reason = ctx.message.text === '-' ? '' : ctx.message.text;
    const vac = await getVacationById(s.vacationId);
    if (vac) {
      await rejectVacation(s.vacationId, reason);
      if (vac.telegram_id) {
        await bot.telegram.sendMessage(
          vac.telegram_id,
          `❌ Заявка отклонена.${reason ? `\nПричина: ${reason}` : ''}`
        );
      }
    }
    clearSession(ctx.from.id);
    await ctx.reply('Заявка отклонена, сотрудник уведомлён.');
  });
}
