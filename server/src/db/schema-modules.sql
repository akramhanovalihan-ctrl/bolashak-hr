-- SQLite modules schema

CREATE TABLE IF NOT EXISTS hr_timesheets (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  schedule_type_snapshot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected')),
  approved_by TEXT REFERENCES hr_users(id),
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(unit_id, year, month)
);

CREATE TABLE IF NOT EXISTS hr_timesheet_entries (
  id TEXT PRIMARY KEY,
  timesheet_id TEXT NOT NULL REFERENCES hr_timesheets(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  hours_worked REAL NOT NULL DEFAULT 0,
  hours_norm REAL NOT NULL DEFAULT 160,
  shift_data TEXT,
  absence_data TEXT,
  notes TEXT,
  UNIQUE(timesheet_id, employee_id)
);

CREATE TABLE IF NOT EXISTS hr_advances (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  requested_amount REAL NOT NULL,
  max_allowed REAL,
  approved_amount REAL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, year, month)
);

CREATE TABLE IF NOT EXISTS hr_payroll (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  advance_paid REAL NOT NULL DEFAULT 0,
  deductions REAL NOT NULL DEFAULT 0,
  manual_deductions REAL NOT NULL DEFAULT 0,
  bonuses REAL NOT NULL DEFAULT 0,
  final_amount REAL NOT NULL DEFAULT 0,
  monthly_salary REAL,
  hours_norm REAL,
  hours_worked REAL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','paid')),
  notes TEXT,
  UNIQUE(employee_id, year, month)
);

CREATE TABLE IF NOT EXISTS hr_vacations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  type TEXT NOT NULL CHECK (type IN ('AL','SL','UL','EL','ML','BT')),
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  days_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','manager_ok','approved','rejected')),
  reason TEXT,
  created_by TEXT REFERENCES hr_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_shift_schedules (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  schedule_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(unit_id, year, month)
);

CREATE TABLE IF NOT EXISTS hr_onboarding_tasks (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('onboard','offboard')),
  title TEXT NOT NULL,
  responsible_role TEXT,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_disciplinary (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES hr_employees(id),
  unit_id TEXT NOT NULL REFERENCES hr_units(id),
  violation_type TEXT NOT NULL,
  violation_date TEXT NOT NULL,
  deduction_amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  recorded_by TEXT REFERENCES hr_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hr_documents (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES hr_employees(id),
  unit_id TEXT REFERENCES hr_units(id),
  doc_type TEXT NOT NULL,
  title TEXT NOT NULL,
  file_name TEXT,
  content TEXT,
  created_by TEXT REFERENCES hr_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
