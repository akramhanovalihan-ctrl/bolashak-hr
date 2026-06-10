import {
  findEmployeeByPhone, findEmployeeByNumber, findEmployeeByName,
  getContextByTelegram, completeEmployeeLink, roleLabel, commandsForRole,
} from '../auth.js';
import { getSession, setSession, clearSession } from '../session.js';
import { contactKeyboard, mainMenu } from '../keyboards.js';

async function welcomeLinked(ctx, emp, linked) {
  await ctx.reply(
    `✅ Привязано: ${emp.full_name}\n` +
    `Подразделение: ${emp.unit_name || '—'}\n` +
    `Роль: ${roleLabel(linked.role)}\n\n` +
    `Команды:\n${commandsForRole(linked.role).join('\n')}`,
    mainMenu
  );
}

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
      'Добро пожаловать в @BolashakHRBot!\n\n' +
      '1. Нажмите «Поделиться контактом»\n' +
      '2. Если телефона нет в базе — введите ФИО (например: Мейрманова Айзада)',
      contactKeyboard
    );
  });

  bot.on('contact', async (ctx) => {
    const contact = ctx.message.contact;
    if (contact.user_id !== ctx.from.id) {
      return ctx.reply('Используйте свой контакт, не чужой.');
    }

    let emp = await findEmployeeByPhone(contact.phone_number);
    if (emp) {
      await completeEmployeeLink(emp.id, ctx.from.id, ctx.from.username, contact.phone_number);
      const linked = await getContextByTelegram(ctx.from.id);
      return welcomeLinked(ctx, emp, linked);
    }

    setSession(ctx.from.id, {
      flow: 'link',
      step: 'fio',
      phone: contact.phone_number,
    });
    return ctx.reply(
      'Телефон сохранён, но в базе HR его ещё нет.\n\n' +
      'Введите ваше ФИО полностью, как в кадровой системе:\n' +
      'Пример: Мейрманова Айзада',
      mainMenu
    );
  });

  bot.on('text', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (s.flow !== 'link' || s.step !== 'fio') return next();

    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) return next();

    let emp = await findEmployeeByName(text);
    if (!emp) emp = await findEmployeeByNumber(text);
    if (!emp) {
      return ctx.reply(
        'Сотрудник не найден. Проверьте ФИО или обратитесь к HR (Талшын).\n' +
        'Пример: Мейрманова Айзада'
      );
    }

    await completeEmployeeLink(emp.id, ctx.from.id, ctx.from.username, s.phone);
    clearSession(ctx.from.id);
    const linked = await getContextByTelegram(ctx.from.id);
    return welcomeLinked(ctx, emp, linked);
  });
}
