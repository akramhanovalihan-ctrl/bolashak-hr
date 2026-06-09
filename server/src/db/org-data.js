/** Оргструктура Болашак — из ТЗ v1.1 + штатное расписание по подразделениям */

export const UNITS = [
  { code: 'store_bajova', name: 'Магазин Бажова', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.bajova@bolashak.local', full_name: 'Серик Ахметов', role: 'manager' } },
  { code: 'store_menovnoe', name: 'Магазин Меновное', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.menovnoe@bolashak.local', full_name: 'Айгуль Садыкова', role: 'manager' } },
  { code: 'store_bolshenarym', name: 'Магазин Большенарым', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.bolshenarym@bolashak.local', full_name: 'Данияр Омаров', role: 'manager' } },
  { code: 'store_orc', name: 'Магазин ОРЦ', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.orc@bolashak.local', full_name: 'Жанар Касымова', role: 'manager' } },
  { code: 'store_domino', name: 'Магазин Домино', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.domino@bolashak.local', full_name: 'Ерлан Бекенов', role: 'manager' } },
  { code: 'store_shemonaiha', name: 'Магазин Шемонайха', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.shemonaiha@bolashak.local', full_name: 'Руководитель Шемонайха', role: 'manager' } },
  { code: 'store_kalbatau', name: 'Магазин Калбатау', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.kalbatau@bolashak.local', full_name: 'Руководитель Калбатау', role: 'manager' } },
  { code: 'store_glubokoe', name: 'Магазин Глубокое', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.glubokoe@bolashak.local', full_name: 'Руководитель Глубокое', role: 'manager' } },
  { code: 'store_zelenyi', name: 'Магазин Зеленый', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.zelenyi@bolashak.local', full_name: 'Руководитель Зеленый', role: 'manager' } },
  { code: 'store_innarus', name: 'Магазин Иннарус', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.innarus@bolashak.local', full_name: 'Руководитель Иннарус', role: 'manager' } },
  { code: 'store_samarskoe', name: 'Магазин Самарское', unit_type: 'store', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'mgr.samarskoe@bolashak.local', full_name: 'Руководитель Самарское', role: 'manager' } },
  { code: 'rc_ust', name: 'РЦ (распред. центр)', unit_type: 'warehouse', schedule_type: 'shift_mixed', hours_norm_default: 176,
    manager: { email: 'aisana@bolashak.local', full_name: 'Айсана Жумагулова', role: 'manager' } },
  { code: 'office_aup', name: 'АУП', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160,
    manager: { email: 'aizada@bolashak.local', full_name: 'Айзада Меирманова', role: 'admin' } },
  { code: 'office_marketing', name: 'Маркетинг', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160,
    manager: { email: 'diana@bolashak.local', full_name: 'Диана Халелова', role: 'manager' } },
  { code: 'office_fin', name: 'Бухгалтерия/Финансы', unit_type: 'office', schedule_type: 'standard_5_2', hours_norm_default: 160,
    manager: { email: 'galina@bolashak.local', full_name: 'Галина', role: 'finance' } },
  { code: 'it', name: 'IT', unit_type: 'office', schedule_type: 'flexible', hours_norm_default: 160,
    manager: { email: 'alihan@bolashak.local', full_name: 'Алихан', role: 'manager' } },
  { code: 'security', name: 'СБ (служба безопасности)', unit_type: 'security', schedule_type: 'shift', hours_norm_default: 168,
    manager: { email: 'ernar@bolashak.local', full_name: 'Эрнар', role: 'manager' } },
];

export const USERS = [
  { email: 'aizada@bolashak.local', full_name: 'Айзада Меирманова', role: 'admin', password: 'admin123', unit_code: 'office_aup' },
  { email: 'talshyn@bolashak.local', full_name: 'Талшын', role: 'hr', password: 'hr123' },
  { email: 'galina@bolashak.local', full_name: 'Галина', role: 'finance', password: 'fin123', unit_code: 'office_fin' },
  { email: 'alihan@bolashak.local', full_name: 'Алихан', role: 'manager', password: 'it123', unit_code: 'it' },
  { email: 'aidyn@bolashak.local', full_name: 'Айдын', role: 'manager', password: 'it123', unit_code: 'it' },
];

/** key = уникальный идентификатор для upsert */
export const EMPLOYEES = [
  // Магазин Бажова
  { key: 'bajova_mgr', unit_code: 'store_bajova', full_name: 'Серик Ахметов', position: 'Руководитель магазина', salary: 280000, birth_date: '1985-03-12', hire_date: '2019-04-01', staff_category: 'manager' },
  { key: 'bajova_1', unit_code: 'store_bajova', full_name: 'Алма Нуртазина', position: 'Кассир', salary: 180000, birth_date: '1998-07-22', hire_date: '2022-01-15', staff_category: 'worker' },
  { key: 'bajova_2', unit_code: 'store_bajova', full_name: 'Болат Ермеков', position: 'Продавец-консультант', salary: 175000, birth_date: '1995-11-08', hire_date: '2021-06-01', staff_category: 'worker' },
  { key: 'bajova_3', unit_code: 'store_bajova', full_name: 'Гульнара Искакова', position: 'Кладовщик', salary: 170000, birth_date: '1990-02-14', hire_date: '2020-09-10', staff_category: 'worker' },
  // Меновное
  { key: 'menovnoe_mgr', unit_code: 'store_menovnoe', full_name: 'Айгуль Садыкова', position: 'Руководитель магазина', salary: 275000, birth_date: '1987-05-30', hire_date: '2018-08-01', staff_category: 'manager' },
  { key: 'menovnoe_1', unit_code: 'store_menovnoe', full_name: 'Канат Абдуллин', position: 'Кассир', salary: 178000, birth_date: '1999-01-19', hire_date: '2023-03-01', staff_category: 'worker' },
  { key: 'menovnoe_2', unit_code: 'store_menovnoe', full_name: 'Сауле Мухамедова', position: 'Продавец', salary: 172000, birth_date: '1996-09-05', hire_date: '2022-11-15', staff_category: 'worker' },
  // Большенарым
  { key: 'bolshenarym_mgr', unit_code: 'store_bolshenarym', full_name: 'Данияр Омаров', position: 'Руководитель магазина', salary: 290000, birth_date: '1983-12-01', hire_date: '2017-02-01', staff_category: 'manager' },
  { key: 'bolshenarym_1', unit_code: 'store_bolshenarym', full_name: 'Айжан Толеуова', position: 'Кассир', salary: 185000, birth_date: '1997-04-18', hire_date: '2021-01-10', staff_category: 'worker' },
  { key: 'bolshenarym_2', unit_code: 'store_bolshenarym', full_name: 'Нурлан Калиев', position: 'Грузчик', salary: 165000, birth_date: '1992-08-25', hire_date: '2020-05-20', staff_category: 'worker' },
  // ОРЦ
  { key: 'orc_mgr', unit_code: 'store_orc', full_name: 'Жанар Касымова', position: 'Руководитель магазина', salary: 285000, birth_date: '1986-06-14', hire_date: '2019-01-15', staff_category: 'manager' },
  { key: 'orc_1', unit_code: 'store_orc', full_name: 'Мадина Серикова', position: 'Кассир', salary: 182000, birth_date: '2000-03-07', hire_date: '2023-07-01', staff_category: 'worker' },
  { key: 'orc_2', unit_code: 'store_orc', full_name: 'Ержан Сапаров', position: 'Продавец', salary: 176000, birth_date: '1994-10-11', hire_date: '2022-04-01', staff_category: 'worker' },
  // Домино
  { key: 'domino_mgr', unit_code: 'store_domino', full_name: 'Ерлан Бекенов', position: 'Руководитель магазина', salary: 280000, birth_date: '1984-08-09', hire_date: '2018-11-01', staff_category: 'manager' },
  { key: 'domino_1', unit_code: 'store_domino', full_name: 'Асель Кенжебаева', position: 'Кассир', salary: 180000, birth_date: '1998-12-20', hire_date: '2022-08-15', staff_category: 'worker' },
  { key: 'domino_2', unit_code: 'store_domino', full_name: 'Рустем Жанибеков', position: 'Продавец', salary: 174000, birth_date: '1993-05-16', hire_date: '2021-10-01', staff_category: 'worker' },
  // РЦ
  { key: 'rc_mgr', unit_code: 'rc_ust', full_name: 'Айсана Жумагулова', position: 'Руководитель РЦ', salary: 350000, birth_date: '1982-01-28', hire_date: '2016-06-01', staff_category: 'manager' },
  { key: 'rc_1', unit_code: 'rc_ust', full_name: 'Берик Нурланов', position: 'Кладовщик', salary: 200000, birth_date: '1991-07-03', hire_date: '2020-02-01', staff_category: 'worker' },
  { key: 'rc_2', unit_code: 'rc_ust', full_name: 'Динара Оспанова', position: 'Комплектовщик', salary: 195000, birth_date: '1995-02-17', hire_date: '2021-03-15', staff_category: 'worker' },
  { key: 'rc_3', unit_code: 'rc_ust', full_name: 'Марат Тулебаев', position: 'Водитель', salary: 220000, birth_date: '1988-11-30', hire_date: '2019-09-01', staff_category: 'worker' },
  { key: 'rc_4', unit_code: 'rc_ust', full_name: 'Салтанат Ермекова', position: 'Оператор WMS', salary: 210000, birth_date: '1993-04-22', hire_date: '2022-01-10', staff_category: 'specialist' },
  // АУП
  { key: 'aup_mgr', unit_code: 'office_aup', full_name: 'Айзада Меирманова', position: 'Генеральный директор', salary: 500000, birth_date: '1980-09-15', hire_date: '2015-01-01', staff_category: 'manager' },
  { key: 'aup_1', unit_code: 'office_aup', full_name: 'Айгерим Султанова', position: 'Офис-менеджер', salary: 220000, birth_date: '1992-06-08', hire_date: '2020-04-01', staff_category: 'specialist' },
  { key: 'aup_2', unit_code: 'office_aup', full_name: 'Тимур Байжанов', position: 'Юрист', salary: 300000, birth_date: '1989-03-25', hire_date: '2019-07-01', staff_category: 'specialist' },
  // Маркетинг
  { key: 'mkt_mgr', unit_code: 'office_marketing', full_name: 'Диана Халелова', position: 'Руководитель маркетинга', salary: 380000, birth_date: '1985-10-10', hire_date: '2018-03-01', staff_category: 'manager' },
  { key: 'mkt_1', unit_code: 'office_marketing', full_name: 'Алия Мусина', position: 'SMM-менеджер', salary: 250000, birth_date: '1996-01-12', hire_date: '2021-05-01', staff_category: 'specialist' },
  { key: 'mkt_2', unit_code: 'office_marketing', full_name: 'Арман Даулетов', position: 'Дизайнер', salary: 240000, birth_date: '1994-08-07', hire_date: '2022-02-15', staff_category: 'specialist' },
  // Бухгалтерия
  { key: 'fin_mgr', unit_code: 'office_fin', full_name: 'Галина', position: 'Главный бухгалтер', salary: 400000, birth_date: '1978-12-05', hire_date: '2014-06-01', staff_category: 'manager' },
  { key: 'fin_1', unit_code: 'office_fin', full_name: 'Светлана Ким', position: 'Бухгалтер', salary: 260000, birth_date: '1990-04-14', hire_date: '2019-01-15', staff_category: 'specialist' },
  { key: 'fin_2', unit_code: 'office_fin', full_name: 'Наталья Петрова', position: 'Экономист', salary: 270000, birth_date: '1987-07-19', hire_date: '2020-08-01', staff_category: 'specialist' },
  // IT
  { key: 'it_1', unit_code: 'it', full_name: 'Алихан', position: 'Руководитель IT', salary: 450000, birth_date: '1995-05-20', hire_date: '2020-01-01', staff_category: 'manager' },
  { key: 'it_2', unit_code: 'it', full_name: 'Айдын', position: 'Разработчик', salary: 400000, birth_date: '1997-11-03', hire_date: '2021-06-01', staff_category: 'specialist' },
  // СБ
  { key: 'sb_mgr', unit_code: 'security', full_name: 'Эрнар', position: 'Руководитель СБ', salary: 320000, birth_date: '1981-02-28', hire_date: '2017-05-01', staff_category: 'manager' },
  { key: 'sb_1', unit_code: 'security', full_name: 'Асхат Болатов', position: 'Охранник', salary: 190000, birth_date: '1993-09-18', hire_date: '2021-01-01', staff_category: 'worker' },
  { key: 'sb_2', unit_code: 'security', full_name: 'Кайрат Мукашев', position: 'Охранник', salary: 188000, birth_date: '1991-06-22', hire_date: '2020-03-01', staff_category: 'worker' },
];
