import { randomUUID } from 'crypto';
import { getPool } from './index.js';

const EMPLOYEE_COLUMNS = [
  { name: 'gender', sqlite: 'TEXT', mssql: 'NVARCHAR(10) NULL' },
  { name: 'citizenship', sqlite: 'TEXT', mssql: 'NVARCHAR(50) NULL' },
  { name: 'marital_status', sqlite: 'TEXT', mssql: 'NVARCHAR(20) NULL' },
  { name: 'address', sqlite: 'TEXT', mssql: 'NVARCHAR(500) NULL' },
  { name: 'personal_email', sqlite: 'TEXT', mssql: 'NVARCHAR(100) NULL' },
  { name: 'work_email', sqlite: 'TEXT', mssql: 'NVARCHAR(100) NULL' },
  { name: 'id_document_number', sqlite: 'TEXT', mssql: 'NVARCHAR(50) NULL' },
  { name: 'id_document_issued_by', sqlite: 'TEXT', mssql: 'NVARCHAR(200) NULL' },
  { name: 'id_document_issued_date', sqlite: 'TEXT', mssql: 'DATE NULL' },
  { name: 'employee_number', sqlite: 'TEXT', mssql: 'NVARCHAR(20) NULL' },
  { name: 'contract_number', sqlite: 'TEXT', mssql: 'NVARCHAR(50) NULL' },
  { name: 'termination_date', sqlite: 'TEXT', mssql: 'DATE NULL' },
  { name: 'termination_reason', sqlite: 'TEXT', mssql: 'NVARCHAR(200) NULL' },
  { name: 'staff_category', sqlite: 'TEXT', mssql: 'NVARCHAR(20) NULL' },
  { name: 'work_schedule', sqlite: 'TEXT', mssql: 'NVARCHAR(50) NULL' },
  { name: 'vacation_days_balance', sqlite: 'REAL', mssql: 'DECIMAL(5,1) NULL' },
  { name: 'education_level', sqlite: 'TEXT', mssql: 'NVARCHAR(50) NULL' },
  { name: 'education_specialty', sqlite: 'TEXT', mssql: 'NVARCHAR(200) NULL' },
  { name: 'bank_name', sqlite: 'TEXT', mssql: 'NVARCHAR(100) NULL' },
  { name: 'bank_account', sqlite: 'TEXT', mssql: 'NVARCHAR(34) NULL' },
  { name: 'has_children', sqlite: 'INTEGER', mssql: 'BIT NULL' },
  { name: 'children_count', sqlite: 'INTEGER', mssql: 'INT NULL' },
  { name: 'disability_group', sqlite: 'INTEGER', mssql: 'INT NULL' },
  { name: 'notes', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX) NULL' },
];

function migrateSqlite(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info(hr_employees)").all().map((c) => c.name)
  );
  for (const col of EMPLOYEE_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_employees ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migrateMssql(pool) {
  for (const col of EMPLOYEE_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_employees') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_employees ADD ${col.name} ${col.mssql};
    `);
  }
}

const ENTRY_COLUMNS = [
  { name: 'fine_amount', sqlite: 'REAL', mssql: 'DECIMAL(10,2) NULL' },
  { name: 'advance_amount', sqlite: 'REAL', mssql: 'DECIMAL(10,2) NULL' },
];

const PAYROLL_COLUMNS = [
  { name: 'monthly_salary', sqlite: 'REAL', mssql: 'DECIMAL(10,2) NULL' },
  { name: 'hours_norm', sqlite: 'REAL', mssql: 'DECIMAL(5,2) NULL' },
  { name: 'hours_worked', sqlite: 'REAL', mssql: 'DECIMAL(5,2) NULL' },
];

const USER_COLUMNS = [
  { name: 'job_title', sqlite: 'TEXT', mssql: 'NVARCHAR(200) NULL' },
  { name: 'employee_id', sqlite: 'TEXT', mssql: 'UNIQUEIDENTIFIER NULL' },
];

function migrateEntriesSqlite(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info(hr_timesheet_entries)").all().map((c) => c.name)
  );
  for (const col of ENTRY_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_timesheet_entries ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migrateEntriesMssql(pool) {
  for (const col of ENTRY_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_timesheet_entries') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_timesheet_entries ADD ${col.name} ${col.mssql};
    `);
  }
}

function migrateUsersSqlite(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info(hr_users)").all().map((c) => c.name)
  );
  for (const col of USER_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_users ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migrateUsersMssql(pool) {
  for (const col of USER_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_users') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_users ADD ${col.name} ${col.mssql};
    `);
  }
}

function migratePayrollSqlite(db) {
  const existing = new Set(
    db.prepare("PRAGMA table_info(hr_payroll)").all().map((c) => c.name)
  );
  for (const col of PAYROLL_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_payroll ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migratePayrollMssql(pool) {
  for (const col of PAYROLL_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_payroll') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_payroll ADD ${col.name} ${col.mssql};
    `);
  }
}

const DOCUMENT_COLUMNS = [
  { name: 'status', sqlite: "TEXT NOT NULL DEFAULT 'draft'", mssql: "NVARCHAR(20) NOT NULL DEFAULT 'draft'" },
  { name: 'visibility', sqlite: 'TEXT', mssql: 'NVARCHAR(MAX) NULL' },
  { name: 'published_by', sqlite: 'TEXT', mssql: 'UNIQUEIDENTIFIER NULL' },
  { name: 'published_at', sqlite: 'TEXT', mssql: 'DATETIME2 NULL' },
];

function migrateDocumentsSqlite(db) {
  const existing = new Set(
    db.prepare('PRAGMA table_info(hr_documents)').all().map((c) => c.name)
  );
  for (const col of DOCUMENT_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_documents ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migrateDocumentsMssql(pool) {
  for (const col of DOCUMENT_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_documents') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_documents ADD ${col.name} ${col.mssql};
    `);
  }
}

const V2_TABLES_SQLITE = `
CREATE TABLE IF NOT EXISTS hr_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES hr_users(id),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS hr_onboarding_templates (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL CHECK (task_type IN ('onboard','offboard')),
  title TEXT NOT NULL,
  responsible_role TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);
`;

function ensureV2TablesSqlite(db) {
  db.exec(V2_TABLES_SQLITE);
  migrateDocumentsSqlite(db);
  seedOnboardingTemplatesSqlite(db);
}

async function ensureV2TablesMssql(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_notifications' AND schema_id = SCHEMA_ID('hr'))
    CREATE TABLE hr.hr_notifications (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      user_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_users(id),
      title NVARCHAR(200) NOT NULL,
      body NVARCHAR(MAX) NULL,
      link NVARCHAR(500) NULL,
      is_read BIT NOT NULL DEFAULT 0,
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_onboarding_templates' AND schema_id = SCHEMA_ID('hr'))
    CREATE TABLE hr.hr_onboarding_templates (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      task_type NVARCHAR(20) NOT NULL,
      title NVARCHAR(300) NOT NULL,
      responsible_role NVARCHAR(50) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active BIT NOT NULL DEFAULT 1
    );
  `);
  await migrateDocumentsMssql(pool);
  await seedOnboardingTemplatesMssql(pool);
}

const EMPLOYEE_TELEGRAM_COLUMNS = [
  { name: 'telegram_id', sqlite: 'TEXT', mssql: 'NVARCHAR(30) NULL' },
];

function migrateEmployeeTelegramSqlite(db) {
  const existing = new Set(
    db.prepare('PRAGMA table_info(hr_employees)').all().map((c) => c.name)
  );
  for (const col of EMPLOYEE_TELEGRAM_COLUMNS) {
    if (!existing.has(col.name)) {
      db.exec(`ALTER TABLE hr_employees ADD COLUMN ${col.name} ${col.sqlite}`);
    }
  }
}

async function migrateEmployeeTelegramMssql(pool) {
  for (const col of EMPLOYEE_TELEGRAM_COLUMNS) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('hr.hr_employees') AND name = '${col.name}'
      )
      ALTER TABLE hr.hr_employees ADD ${col.name} ${col.mssql};
    `);
  }
}

const PULSE_TABLE_SQLITE = `
CREATE TABLE IF NOT EXISTS hr_pulse_surveys (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  survey_date TEXT NOT NULL,
  q1_score REAL,
  q2_score REAL,
  q3_score REAL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

function ensurePulseTableSqlite(db) {
  db.exec(PULSE_TABLE_SQLITE);
  migrateEmployeeTelegramSqlite(db);
}

async function ensurePulseTableMssql(pool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_pulse_surveys' AND schema_id = SCHEMA_ID('hr'))
    CREATE TABLE hr.hr_pulse_surveys (
      id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
      unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
      survey_date DATE NOT NULL,
      q1_score DECIMAL(3,1) NULL,
      q2_score DECIMAL(3,1) NULL,
      q3_score DECIMAL(3,1) NULL,
      comment NVARCHAR(MAX) NULL,
      created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
  `);
  await migrateEmployeeTelegramMssql(pool);
}

const ONBOARD_SEED = [
  { task_type: 'onboard', title: 'Подписание трудового договора', responsible_role: 'hr', sort_order: 1 },
  { task_type: 'onboard', title: 'Инструктаж по ОТ и ТБ', responsible_role: 'manager', sort_order: 2 },
  { task_type: 'onboard', title: 'Выдача формы / рабочей одежды', responsible_role: 'manager', sort_order: 3 },
  { task_type: 'onboard', title: 'Создание учётных записей в системах', responsible_role: 'it', sort_order: 4 },
  { task_type: 'onboard', title: 'Добавление в Telegram-чат подразделения', responsible_role: 'manager', sort_order: 5 },
  { task_type: 'offboard', title: 'Возврат формы и ключей', responsible_role: 'manager', sort_order: 1 },
  { task_type: 'offboard', title: 'Закрытие доступов в системах', responsible_role: 'it', sort_order: 2 },
  { task_type: 'offboard', title: 'Финальный расчёт', responsible_role: 'finance', sort_order: 3 },
];

function seedOnboardingTemplatesSqlite(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM hr_onboarding_templates').get().c;
  if (count > 0) return;
  const stmt = db.prepare(
    `INSERT INTO hr_onboarding_templates (id, task_type, title, responsible_role, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  );
  for (const row of ONBOARD_SEED) {
    stmt.run(randomUUID(), row.task_type, row.title, row.responsible_role, row.sort_order);
  }
}

async function seedOnboardingTemplatesMssql(pool) {
  const { recordset } = await pool.request().query('SELECT COUNT(*) AS c FROM hr.hr_onboarding_templates');
  if (recordset[0]?.c > 0) return;
  for (const row of ONBOARD_SEED) {
    await pool.request()
      .input('id', randomUUID())
      .input('task_type', row.task_type)
      .input('title', row.title)
      .input('responsible_role', row.responsible_role)
      .input('sort_order', row.sort_order)
      .query(`
        INSERT INTO hr.hr_onboarding_templates (id, task_type, title, responsible_role, sort_order, is_active)
        VALUES (@id, @task_type, @title, @responsible_role, @sort_order, 1)
      `);
  }
}

export async function runMigrations() {
  const driver = process.env.DB_DRIVER || 'mssql';
  if (driver === 'sqlite') {
    const db = getPool();
    migrateSqlite(db);
    migrateEntriesSqlite(db);
    migratePayrollSqlite(db);
    migrateUsersSqlite(db);
    ensureV2TablesSqlite(db);
    ensurePulseTableSqlite(db);
  } else {
    const pool = await getPool();
    await migrateMssql(pool);
    await migrateEntriesMssql(pool);
    await migratePayrollMssql(pool);
    await migrateUsersMssql(pool);
    await ensureV2TablesMssql(pool);
    await ensurePulseTableMssql(pool);
  }
}
