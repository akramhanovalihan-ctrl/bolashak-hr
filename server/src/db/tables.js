const isSqlite = process.env.DB_DRIVER === 'sqlite';
const schema = isSqlite ? '' : 'hr.';

export const users = `${schema}hr_users`;
export const units = `${schema}hr_units`;
export const employees = `${schema}hr_employees`;
export const auditLog = `${schema}hr_audit_log`;
export const timesheets = `${schema}hr_timesheets`;
export const timesheetEntries = `${schema}hr_timesheet_entries`;
export const advances = `${schema}hr_advances`;
export const payroll = `${schema}hr_payroll`;
export const vacations = `${schema}hr_vacations`;
export const shiftSchedules = `${schema}hr_shift_schedules`;
export const onboardingTasks = `${schema}hr_onboarding_tasks`;
export const disciplinary = `${schema}hr_disciplinary`;
export const documents = `${schema}hr_documents`;
