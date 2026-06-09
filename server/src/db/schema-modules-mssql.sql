IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_timesheets' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_timesheets (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  year INT NOT NULL, month INT NOT NULL,
  schedule_type_snapshot NVARCHAR(20) NOT NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by UNIQUEIDENTIFIER REFERENCES hr.hr_users(id),
  approved_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_timesheet_period UNIQUE(unit_id, year, month)
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_timesheet_entries' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_timesheet_entries (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  timesheet_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_timesheets(id) ON DELETE CASCADE,
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0,
  hours_norm DECIMAL(5,2) NOT NULL DEFAULT 160,
  shift_data NVARCHAR(MAX), absence_data NVARCHAR(MAX), notes NVARCHAR(MAX),
  CONSTRAINT UQ_entry UNIQUE(timesheet_id, employee_id)
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_advances' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_advances (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  year INT NOT NULL, month INT NOT NULL,
  requested_amount DECIMAL(10,2) NOT NULL,
  max_allowed DECIMAL(10,2), approved_amount DECIMAL(10,2),
  status NVARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_advance UNIQUE(employee_id, year, month)
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_payroll' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_payroll (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  year INT NOT NULL, month INT NOT NULL,
  base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  advance_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  manual_deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonuses DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status NVARCHAR(20) NOT NULL DEFAULT 'draft',
  notes NVARCHAR(MAX),
  CONSTRAINT UQ_payroll UNIQUE(employee_id, year, month)
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_vacations' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_vacations (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  type NVARCHAR(5) NOT NULL, date_from DATE NOT NULL, date_to DATE NOT NULL,
  days_count INT NOT NULL, status NVARCHAR(20) NOT NULL DEFAULT 'pending',
  reason NVARCHAR(MAX), created_by UNIQUEIDENTIFIER REFERENCES hr.hr_users(id),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_shift_schedules' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_shift_schedules (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  year INT NOT NULL, month INT NOT NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'draft',
  schedule_data NVARCHAR(MAX),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_shift UNIQUE(unit_id, year, month)
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_onboarding_tasks' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_onboarding_tasks (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  task_type NVARCHAR(10) NOT NULL, title NVARCHAR(200) NOT NULL,
  responsible_role NVARCHAR(50), due_date DATE,
  status NVARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_disciplinary' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_disciplinary (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_employees(id),
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  violation_type NVARCHAR(20) NOT NULL, violation_date DATE NOT NULL,
  deduction_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  description NVARCHAR(MAX), recorded_by UNIQUEIDENTIFIER REFERENCES hr.hr_users(id),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_documents' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_documents (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  employee_id UNIQUEIDENTIFIER REFERENCES hr.hr_employees(id),
  unit_id UNIQUEIDENTIFIER REFERENCES hr.hr_units(id),
  doc_type NVARCHAR(50) NOT NULL, title NVARCHAR(200) NOT NULL,
  file_name NVARCHAR(200), content NVARCHAR(MAX),
  created_by UNIQUEIDENTIFIER REFERENCES hr.hr_users(id),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
