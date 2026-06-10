import { randomUUID } from 'crypto';
import { query } from '../db/index.js';
import { onboardingTasks, onboardingTemplates } from '../db/tables.js';

const FALLBACK_ONBOARD = [
  { title: 'Подписание трудового договора', responsible_role: 'hr' },
  { title: 'Инструктаж по ОТ и ТБ', responsible_role: 'manager' },
  { title: 'Выдача формы / рабочей одежды', responsible_role: 'manager' },
  { title: 'Создание учётных записей в системах', responsible_role: 'it' },
  { title: 'Добавление в Telegram-чат подразделения', responsible_role: 'manager' },
];

const FALLBACK_OFFBOARD = [
  { title: 'Возврат формы и ключей', responsible_role: 'manager' },
  { title: 'Закрытие доступов в системах', responsible_role: 'it' },
  { title: 'Финальный расчёт', responsible_role: 'finance' },
];

export async function loadTemplate(taskType) {
  const active = process.env.DB_DRIVER === 'sqlite' ? 1 : 1;
  const { rows } = await query(
    `SELECT title, responsible_role FROM ${onboardingTemplates}
     WHERE task_type = $1 AND is_active = $2 ORDER BY sort_order, title`,
    [taskType, active]
  );
  if (rows.length) return rows;
  return taskType === 'offboard' ? FALLBACK_OFFBOARD : FALLBACK_ONBOARD;
}

export async function startOnboardingForEmployee(employeeId, taskType = 'onboard', hireDate = new Date()) {
  const template = await loadTemplate(taskType);
  const base = hireDate instanceof Date ? hireDate : new Date(hireDate);

  for (let i = 0; i < template.length; i++) {
    const due = new Date(base);
    due.setDate(due.getDate() + i);
    await query(
      `INSERT INTO ${onboardingTasks} (id, employee_id, task_type, title, responsible_role, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [
        randomUUID(),
        employeeId,
        taskType,
        template[i].title,
        template[i].responsible_role,
        due.toISOString().slice(0, 10),
      ]
    );
  }
  return template.length;
}
