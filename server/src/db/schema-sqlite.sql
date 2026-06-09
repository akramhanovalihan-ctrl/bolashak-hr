CREATE TABLE IF NOT EXISTS hr_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'finance', 'manager', 'employee')),
  unit_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('store', 'warehouse', 'office', 'security')),
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('shift', 'shift_mixed', 'standard_5_2', 'flexible')),
  hours_norm_default INTEGER NOT NULL DEFAULT 160,
  manager_user_id TEXT REFERENCES hr_users(id),
  telegram_chat_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_employees (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_date TEXT,
  iin_encrypted TEXT,
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  position TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'full'
    CHECK (employment_type IN ('full', 'part', 'hourly', 'contractor')),
  salary REAL,
  hourly_rate REAL,
  hire_date TEXT NOT NULL,
  probation_end_date TEXT,
  phone TEXT,
  telegram_username TEXT,
  emergency_contact TEXT,
  gender TEXT,
  citizenship TEXT,
  marital_status TEXT,
  address TEXT,
  personal_email TEXT,
  work_email TEXT,
  id_document_number TEXT,
  id_document_issued_by TEXT,
  id_document_issued_date TEXT,
  employee_number TEXT,
  contract_number TEXT,
  termination_date TEXT,
  termination_reason TEXT,
  staff_category TEXT,
  work_schedule TEXT,
  vacation_days_balance REAL,
  education_level TEXT,
  education_specialty TEXT,
  bank_name TEXT,
  bank_account TEXT,
  has_children INTEGER,
  children_count INTEGER,
  disability_group INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'terminated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hr_employees_unit_id ON hr_employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(status);

CREATE TABLE IF NOT EXISTS hr_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES hr_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
