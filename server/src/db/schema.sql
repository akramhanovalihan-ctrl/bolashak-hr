IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'hr')
  EXEC('CREATE SCHEMA hr');
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_users' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_users (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  email NVARCHAR(100) NOT NULL UNIQUE,
  password_hash NVARCHAR(MAX) NOT NULL,
  full_name NVARCHAR(200) NOT NULL,
  role NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'hr', 'finance', 'manager', 'employee')),
  unit_id UNIQUEIDENTIFIER NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_units' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_units (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  code NVARCHAR(50) NOT NULL UNIQUE,
  name NVARCHAR(100) NOT NULL,
  unit_type NVARCHAR(20) NOT NULL CHECK (unit_type IN ('store', 'warehouse', 'office', 'security')),
  schedule_type NVARCHAR(20) NOT NULL CHECK (schedule_type IN ('shift', 'shift_mixed', 'standard_5_2', 'flexible')),
  hours_norm_default INT NOT NULL DEFAULT 160,
  manager_user_id UNIQUEIDENTIFIER NULL REFERENCES hr.hr_users(id),
  telegram_chat_id BIGINT NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (
  SELECT * FROM sys.foreign_keys WHERE name = 'FK_hr_users_unit_id'
)
ALTER TABLE hr.hr_users
  ADD CONSTRAINT FK_hr_users_unit_id FOREIGN KEY (unit_id) REFERENCES hr.hr_units(id);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_employees' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_employees (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  full_name NVARCHAR(200) NOT NULL,
  birth_date DATE NULL,
  iin_encrypted NVARCHAR(MAX) NULL,
  unit_id UNIQUEIDENTIFIER NOT NULL REFERENCES hr.hr_units(id),
  position NVARCHAR(100) NOT NULL,
  employment_type NVARCHAR(20) NOT NULL DEFAULT 'full'
    CHECK (employment_type IN ('full', 'part', 'hourly', 'contractor')),
  salary DECIMAL(10, 2) NULL,
  hourly_rate DECIMAL(8, 2) NULL,
  hire_date DATE NOT NULL,
  probation_end_date DATE NULL,
  phone NVARCHAR(20) NULL,
  telegram_username NVARCHAR(100) NULL,
  emergency_contact NVARCHAR(200) NULL,
  gender NVARCHAR(10) NULL,
  citizenship NVARCHAR(50) NULL,
  marital_status NVARCHAR(20) NULL,
  address NVARCHAR(500) NULL,
  personal_email NVARCHAR(100) NULL,
  work_email NVARCHAR(100) NULL,
  id_document_number NVARCHAR(50) NULL,
  id_document_issued_by NVARCHAR(200) NULL,
  id_document_issued_date DATE NULL,
  employee_number NVARCHAR(20) NULL,
  contract_number NVARCHAR(50) NULL,
  termination_date DATE NULL,
  termination_reason NVARCHAR(200) NULL,
  staff_category NVARCHAR(20) NULL,
  work_schedule NVARCHAR(50) NULL,
  vacation_days_balance DECIMAL(5,1) NULL,
  education_level NVARCHAR(50) NULL,
  education_specialty NVARCHAR(200) NULL,
  bank_name NVARCHAR(100) NULL,
  bank_account NVARCHAR(34) NULL,
  has_children BIT NULL,
  children_count INT NULL,
  disability_group INT NULL,
  notes NVARCHAR(MAX) NULL,
  status NVARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'terminated')),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_hr_employees_unit_id' AND object_id = OBJECT_ID('hr.hr_employees'))
  CREATE INDEX idx_hr_employees_unit_id ON hr.hr_employees(unit_id);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_hr_employees_status' AND object_id = OBJECT_ID('hr.hr_employees'))
  CREATE INDEX idx_hr_employees_status ON hr.hr_employees(status);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hr_audit_log' AND schema_id = SCHEMA_ID('hr'))
CREATE TABLE hr.hr_audit_log (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NULL REFERENCES hr.hr_users(id),
  action NVARCHAR(50) NOT NULL,
  entity_type NVARCHAR(50) NOT NULL,
  entity_id UNIQUEIDENTIFIER NULL,
  details NVARCHAR(MAX) NULL,
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
