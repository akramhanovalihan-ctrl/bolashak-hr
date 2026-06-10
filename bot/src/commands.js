/** Регистрация команды с алиасами (опечатки, транслит) */
export function cmd(bot, names, handler) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    bot.command(name, handler);
  }
}

/** Подсказки при частых опечатках */
export const TYPO_HINTS = {
  grafic: '/grafik',
  grаfik: '/grafik',
  график: '/grafik',
  otsustive: '/otsutstvie',
  otsutstvye: '/otsutstvie',
  otsutstviee: '/otsutstvie',
  отсутствие: '/otsutstvie',
  table_magazin: '/tabel_magazin',
  tabel_magasin: '/tabel_magazin',
  zарплата: '/zp',
  onboarding_vse: '/onboarding_vse',
  noviy_sotrudnik: '/noviy_sotrudnik',
  dashboard: '/dashboard',
  help: '/help',
  start: '/start',
  link: '/link',
};

export const ALL_COMMANDS = new Set([
  'start', 'help', 'link',
  'tabel', 'zp', 'grafik', 'otsutstvie', 'moi_zayavki',
  'tabel_magazin', 'onboarding',
  'noviy_sotrudnik', 'onboarding_vse', 'opros', 'tekuchka',
  'dashboard', 'vse_sotrudniki',
  ...Object.keys(TYPO_HINTS),
]);

export function registerUnknownCommandHint(bot) {
  bot.on('text', async (ctx, next) => {
    const raw = ctx.message.text?.trim();
    if (!raw?.startsWith('/')) return next();

    const name = raw.split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
    if (ALL_COMMANDS.has(name)) return next();

    const hint = TYPO_HINTS[name];
    if (hint) {
      await ctx.reply(`Возможно, вы имели в виду ${hint}?\nНажмите на команду или введите её вручную.`);
      return;
    }

    await ctx.reply('Неизвестная команда. Введите /help — список доступных команд.');
  });
}
