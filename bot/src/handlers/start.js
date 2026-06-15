import {
  findEmployeeByPhone, findEmployeeByNumber, findEmployeeByName,
  getContextByTelegram, completeEmployeeLink, roleLabel, commandsForRole,
} from '../auth.js';
import { getSession, setSession, clearSession } from '../session.js';
import { contactKeyboard } from '../keyboards.js';
import { sendRoleMenu } from '../menu.js';

async function welcomeLinked(ctx, emp, linked) {
  const role = linked?.role || 'employee';
  await ctx.reply(
    `✅ Привязано: ${emp.full_name}\n` +
    `Подразделение: ${emp.unit_name || '—'}\n` +
    `Роль: ${roleLabel(role)}`,
  );
  await sendRoleMenu(ctx, role);
}

async function tryLinkByFio(ctx, text, phone) {
  try {
    let emp = await findEmployeeByName(text);
    if (!emp) emp = await findEmployeeByNumber(text);
    if (!emp) {
      await ctx.reply(
        `Сотрудник «${text}» не найден.\n\n` +
        'Проверьте ФИО как в базе HR (например: Акрамханов Алихан или Мейрманова Айзада).\n' +
        'Или поделитесь контактом — телефон сохраним в карточку.'
      );
      return false;
    }
    await completeEmployeeLink(emp.id, ctx.from.id, ctx.from.username, phone);
    clearSession(ctx.from.id);
    const linked = await getContextByTelegram(ctx.from.id);
    const fresh = linked?.employee || emp;
    await welcomeLinked(ctx, fresh, linked);
    return true;
  } catch (err) {
    console.error('tryLinkByFio failed:', err);
    await ctx.reply(
      `Не удалось завершить привязку.\n\n` +
      `Попробуйте ещё раз: /start\n` +
      `Или обратитесь в HR, если ошибка повторяется.`
    );
    return false;
  }
}

export function registerStart(bot) {
  bot.start(async (ctx) => {
    const tgId = ctx.from.id;
    const existing = await getContextByTelegram(tgId);
    if (existing) {
      await ctx.reply(`С возвращением, ${existing.employee.full_name}!`);
      return sendRoleMenu(ctx, existing.role);
    }
    setSession(tgId, { flow: 'link', step: 'fio' });
    await ctx.reply(
      'Добро пожаловать в @BolashakHR_bot!\n\n' +
      '<b>Шаг 1:</b> нажмите «📱 Поделиться контактом»\n' +
      '<b>Шаг 2:</b> или напишите ФИО из базы HR\n' +
      'Пример: Мейрманова Айзада или Нагашыбаева Талшын',
      { ...contactKeyboard, parse_mode: 'HTML' }
    );
  });

  bot.command('link', async (ctx) => {
    const existing = await getContextByTelegram(ctx.from.id);
    if (existing) {
      return ctx.reply(`Вы уже привязаны как ${existing.employee.full_name}.`);
    }
    setSession(ctx.from.id, { flow: 'link', step: 'fio' });
    await ctx.reply('Введите ФИО полностью, как в кадровой системе:');
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

    setSession(ctx.from.id, { flow: 'link', step: 'fio', phone: contact.phone_number });
    return ctx.reply('Телефон сохранён. Теперь введите ФИО полностью:\nПример: Мейрманова Айзада');
  });
}

/** Регистрировать последним — ловит ФИО у непривязанных пользователей */
export function registerLinkFallback(bot) {
  bot.on('text', async (ctx, next) => {
    const text = ctx.message.text?.trim();
    if (!text || text.startsWith('/')) return next();

    const existing = await getContextByTelegram(ctx.from.id);
    if (existing) return next();

    const s = getSession(ctx.from.id);
    const looksLikeName = text.length >= 4 && /[а-яёa-z]/i.test(text) && !/^\d+$/.test(text);

    if (text === '✍️ Ввести ФИО вручную') {
      return ctx.reply('Введите ФИО полностью, как в кадровой системе:\nПример: Мейрманова Айзада');
    }

    if (s.flow === 'link' && s.step === 'fio') {
      return tryLinkByFio(ctx, text, s.phone);
    }

    if (looksLikeName) {
      setSession(ctx.from.id, { flow: 'link', step: 'fio' });
      return tryLinkByFio(ctx, text, undefined);
    }

    return next();
  });
}
