import { Markup } from 'telegraf';

export const contactKeyboard = Markup.keyboard([
  [Markup.button.contactRequest('📱 Поделиться контактом')],
]).resize();

export const mainMenu = Markup.removeKeyboard();

export const leaveTypeKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('Отгул', 'leave:day_off'),
    Markup.button.callback('Отпуск', 'leave:vacation'),
  ],
  [
    Markup.button.callback('Больничный', 'leave:sick'),
    Markup.button.callback('Личное', 'leave:personal'),
  ],
]);

export function confirmKeyboard(action) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да, отправить', `${action}:yes`)],
    [Markup.button.callback('❌ Отмена', `${action}:no`)],
  ]);
}

export function vacationActionKeyboard(vacationId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Апрув', `vac:approve:${vacationId}`),
      Markup.button.callback('❌ Отклонить', `vac:reject:${vacationId}`),
    ],
  ]);
}

export function onboardingTaskKeyboard(taskId) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Выполнено', `onb:done:${taskId}`)],
  ]);
}

export function pulseScoreKeyboard(qNum) {
  const row = [1, 2, 3, 4, 5].map((n) => Markup.button.callback(String(n), `pulse:${qNum}:${n}`));
  return Markup.inlineKeyboard([row]);
}

export function unitsKeyboard(units, prefix = 'unit') {
  const rows = units.slice(0, 12).map((u) => [
    Markup.button.callback(u.name.slice(0, 40), `${prefix}:${u.id}`),
  ]);
  return Markup.inlineKeyboard(rows);
}
