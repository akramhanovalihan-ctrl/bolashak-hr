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

export async function runMigrations() {
  const driver = process.env.DB_DRIVER || 'mssql';
  if (driver === 'sqlite') {
    const db = getPool();
    migrateSqlite(db);
    migrateEntriesSqlite(db);
    migratePayrollSqlite(db);
    migrateUsersSqlite(db);
  } else {
    const pool = await getPool();
    await migrateMssql(pool);
    await migrateEntriesMssql(pool);
    await migratePayrollMssql(pool);
    await migrateUsersMssql(pool);
  }
}
