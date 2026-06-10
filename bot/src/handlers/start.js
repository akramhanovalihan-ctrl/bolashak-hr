import {
  findEmployeeByPhone, findEmployeeByNumber,
  getContextByTelegram, linkTelegram, roleLabel, commandsForRole,
} from '../auth.js';
import { getSession, setSession, clearSession } from '../session.js';
import { contactKeyboard, mainMenu } from '../keyboards.js';

export function registerStart(bot) {
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const existing = await getContextByTelegram(tgId);
    if (existing) {
      return ctx.reply(
        `С возвращением, ${existing.employee.full_name}!\nРоль: ${roleLabel(existing.role)}\n\nКоманды:\n${commandsForRole(existing.role).join('\n')}`,
        mainMenu
      );
    }
    await ctx.reply(
      'Добро пожаловать в @BolashakHRBot!\n\nДля привязки аккаунта поделитесь номером телефона — он должен совпадать с базой HR.',
      contactKeyboard
    );
  });

  bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      return ctx.reply('Используйте свой контакт, не чужой.');
    }
    const emp = await findEmployeeByPhone(contact.phone_number);
    if (!emp) {
      setSession(ctx.from.id, { flow: 'link', step: 'emp_number' });
      return ctx.reply(
        'Телефон не найден в базе HR.\nВведите табельный номер (например TG001) или обратитесь к HR.',
        mainMenu
      );
    }
    await linkTelegram(emp.id, ctx.from.id, ctx.from.username);
    const linked = await getContextByTelegram(ctx.from.id);
    await ctx.reply(
      `✅ Привязано: ${emp.full_name}\nПодразделение: ${emp.unit_name || '—'}\nРоль: ${roleLabel(linked.role)}\n\nКоманды:\n${commandsForRole(linked.role).join('\n')}`,
      mainMenu
    );
  });

  bot.on('text', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (s.flow !== 'link' || s.step !== 'emp_number') return next();
    const emp = await findEmployeeByNumber(ctx.message.text);
    if (!emp) return ctx.reply('Табельный номер не найден. Проверьте или обратитесь к HR.');
    await linkTelegram(emp.id, ctx.from.id, ctx.from.username);
    clearSession(ctx.from.id);
    const linked = await getContextByTelegram(ctx.from.id);
    await ctx.reply(
      `✅ Привязано по табельному номеру: ${emp.full_name}\nРоль: ${roleLabel(linked.role)}\n\n${commandsForRole(linked.role).join('\n')}`
    );
  });
}
