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

async function tryLinkByFio(ctx, text, phone) {
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
  await welcomeLinked(ctx, emp, linked);
  return true;
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
    setSession(tgId, { flow: 'link', step: 'fio' });
    await ctx.reply(
      'Добро пожаловать в @BolashakHRBot!\n\n' +
      '**Вариант 1:** нажмите «Поделиться контактом»\n' +
      '**Вариант 2:** сразу напишите ФИО из базы HR\n' +
      'Пример: `Акрамханов Алихан` или `Мейрманова Айзада`',
      { ...contactKeyboard, parse_mode: 'Markdown' }
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
    return ctx.reply(
      'Телефон сохранён. Теперь введите ФИО полностью:\nПример: Акрамханов Алихан',
      mainMenu
    );
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
