import { getContextByTelegram } from '../auth.js';
import { getSession, setSession, clearSession } from '../session.js';
import { unitsKeyboard } from '../keyboards.js';
import { broadcastPulseSurvey } from '../services/pulse.js';
import {
  listUnits, createEmployee, getAllOnboarding, getTurnoverStats,
  getPulseSummary, listAllEmployees, getManagerTelegramIds,
} from '../queries.js';
import { parseDateInput } from '../gemini.js';

async function requireHr(ctx) {
  const c = await getContextByTelegram(ctx.from.id);
  if (!c) { await ctx.reply('Сначала /start'); return null; }
  if (!['hr', 'admin'].includes(c.role)) {
    await ctx.reply('Команда только для HR.');
    return null;
  }
  return c;
}

export async function handleNoviySotrudnik(ctx) {
  const c = await requireHr(ctx);
  if (!c) return;
  setSession(ctx.from.id, { flow: 'new_emp', step: 'name' });
  await ctx.reply('ФИО нового сотрудника:');
}

export async function handleOnboardingVse(ctx) {
  const c = await requireHr(ctx);
  if (!c) return;
  const tasks = await getAllOnboarding();
  const byEmp = {};
  for (const t of tasks) {
    if (!byEmp[t.employee_id]) byEmp[t.employee_id] = { name: t.full_name, unit: t.unit_name, total: 0, done: 0 };
    byEmp[t.employee_id].total++;
    if (t.status === 'done') byEmp[t.employee_id].done++;
  }
  const lines = Object.values(byEmp).map((e) =>
    `${e.name} (${e.unit}): ${e.done}/${e.total}`
  );
  await ctx.reply(lines.length ? `📋 Онбординг:\n\n${lines.join('\n')}` : 'Нет активного онбординга.');
}

export async function handleOpros(ctx) {
  const c = await requireHr(ctx);
  if (!c) return;
  setSession(ctx.from.id, { flow: 'pulse_broadcast', step: 'confirm' });
  await ctx.reply('Запустить пульс-опрос для всех привязанных сотрудников? Напишите «да» для рассылки.');
}

export async function handleTekuchka(ctx) {
  const c = await requireHr(ctx);
  if (!c) return;
  const rows = await getTurnoverStats();
  if (!rows.length) return ctx.reply('Увольнений за квартал не зафиксировано.');
  const text = rows.map((r) => `${r.name}: ${r.cnt}`).join('\n');
  await ctx.reply(`📉 Текучка за 3 месяца:\n\n${text}`);
}

export function registerHr(bot) {
  bot.command('noviy_sotrudnik', handleNoviySotrudnik);
  bot.command('onboarding_vse', handleOnboardingVse);
  bot.command('opros', handleOpros);
  bot.command('tekuchka', handleTekuchka);

  bot.on('text', async (ctx, next) => {
    const s = getSession(ctx.from.id);
    if (s.flow === 'new_emp') return handleNewEmployeeFlow(ctx, s, next);
    if (s.flow === 'pulse') return handlePulseFlow(ctx, s, next);
    if (s.flow === 'pulse_broadcast') return handlePulseBroadcast(ctx, s, bot, next);
    return next();
  });
}

async function handleNewEmployeeFlow(ctx, s, next) {
  const text = ctx.message.text?.trim();
  if (!text || text.startsWith('/')) return next();

  if (s.step === 'name') {
    setSession(ctx.from.id, { ...s, step: 'phone', full_name: text });
    return ctx.reply('Телефон (+7...):');
  }
  if (s.step === 'phone') {
    setSession(ctx.from.id, { ...s, step: 'unit', phone: text });
    const units = await listUnits();
    return ctx.reply('Выберите подразделение:', unitsKeyboard(units, 'newemp_unit'));
  }
  if (s.step === 'position') {
    setSession(ctx.from.id, { ...s, step: 'hire_date', position: text });
    return ctx.reply('Дата выхода (ДД.ММ.ГГГГ или «завтра»):');
  }
  if (s.step === 'hire_date') {
    const hire = await parseDateInput(text);
    if (!hire) return ctx.reply('Не понял дату. Пример: 15.06.2026');
    const empId = await createEmployee({
      full_name: s.full_name,
      phone: s.phone,
      unit_id: s.unit_id,
      position: s.position,
      employment_type: 'full',
      hire_date: hire,
    });
    clearSession(ctx.from.id);
    await ctx.reply(`✅ Сотрудник создан. ID: ${empId.slice(0, 8)}…\nОнбординг запущен автоматически.`);
    const managers = await getManagerTelegramIds(s.unit_id);
    for (const mid of managers) {
      try {
        await ctx.telegram.sendMessage(mid, `🆕 Новый сотрудник ${s.full_name} — проверьте /onboarding`);
      } catch { /* */ }
    }
  }
}

async function handlePulseBroadcast(ctx, s, bot, next) {
  if (s.step !== 'confirm') return next();
  if (!/^да$/i.test(ctx.message.text?.trim())) {
    clearSession(ctx.from.id);
    return ctx.reply('Рассылка отменена.');
  }
  const sent = await broadcastPulseSurvey(ctx.telegram);
  clearSession(ctx.from.id);
  await ctx.reply(`Опрос отправлен ${sent} сотрудникам.`);
}

async function handlePulseFlow(ctx, s, next) {
  if (s.step === 'comment') {
    const c = await getContextByTelegram(ctx.from.id);
    if (!c) return next();
    const { savePulseAnswer } = await import('../queries.js');
    const comment = ctx.message.text === '-' ? null : ctx.message.text;
    await savePulseAnswer({
      unitId: c.unitId,
      q1: s.q1,
      q2: s.q2,
      q3: s.q3,
      comment,
    });
    clearSession(ctx.from.id);
    return ctx.reply('Спасибо! Ответ сохранён анонимно (только подразделение).');
  }
  return next();
}

export async function handleNewEmpUnitCallback(ctx) {
  const unitId = ctx.callbackQuery.data.split(':')[1];
  const s = getSession(ctx.from.id);
  if (s.flow !== 'new_emp' || s.step !== 'unit') return;
  setSession(ctx.from.id, { ...s, step: 'position', unit_id: unitId });
  await ctx.answerCbQuery();
  await ctx.reply('Должность:');
}

export async function handlePulseCallback(ctx) {
  const [, qNum, score] = ctx.callbackQuery.data.split(':');
  const s = getSession(ctx.from.id);
  if (s.flow !== 'pulse') return ctx.answerCbQuery();
  const n = Number(qNum);
  const sc = Number(score);
  const upd = { ...s, [`q${n}`]: sc };
  if (n < 3) {
    const questions = [
      '',
      '2/3 Насколько понятны задачи?',
      '3/3 Рекомендуете ли компанию коллегам?',
    ];
    setSession(ctx.from.id, { ...upd, step: n + 1 });
    await ctx.answerCbQuery();
    return ctx.reply(questions[n], pulseScoreKeyboard(n + 1));
  }
  setSession(ctx.from.id, { ...upd, step: 'comment' });
  await ctx.answerCbQuery();
  return ctx.reply('Опционально: что мешает работать? (или «-» чтобы пропустить)');
}
