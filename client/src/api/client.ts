const API_BASE = '/api/hr';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data as T;
}

export interface User {
  id: string; email: string; full_name: string;
  role: 'admin' | 'hr' | 'finance' | 'manager' | 'employee';
  unit_id: string | null; unit_name?: string;
}

export interface Unit {
  id: string; code: string; name: string; unit_type: string;
  schedule_type: string; hours_norm_default: number; is_active: boolean;
  manager_user_id?: string | null; manager_name?: string;
}

export interface ManagerCandidate {
  id: string; full_name: string; email: string; role: string;
}

export interface Employee {
  id: string; full_name: string; birth_date?: string; iin?: string;
  unit_id: string; unit_name?: string; position: string; employment_type: string;
  salary?: number; hourly_rate?: number; hire_date: string; probation_end_date?: string;
  phone?: string; telegram_username?: string; emergency_contact?: string; status: string;
  gender?: string; citizenship?: string; marital_status?: string; address?: string;
  personal_email?: string; work_email?: string; id_document_number?: string;
  id_document_issued_by?: string; id_document_issued_date?: string;
  employee_number?: string; contract_number?: string;
  termination_date?: string; termination_reason?: string;
  staff_category?: string; work_schedule?: string; vacation_days_balance?: number;
  education_level?: string; education_specialty?: string;
  bank_name?: string; bank_account?: string;
  has_children?: boolean | number; children_count?: number; disability_group?: number;
  notes?: string;
}

const q = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null) sp.set(k, String(v)); });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export interface HrUser {
  id: string; email: string; full_name: string; role: User['role'];
  unit_id: string | null; unit_name?: string; job_title?: string | null;
  employee_id?: string | null; employee_name?: string | null;
  is_active: number | boolean; created_at?: string;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: { email: string; password: string; password_confirm: string; full_name: string }) =>
    request<{ ok: boolean; message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),
  getUsers: (status?: 'pending' | 'active') =>
    request<{ users: HrUser[] }>(`/users${status ? `?status=${status}` : ''}`),
  updateUser: (id: string, data: {
    is_active?: boolean; role?: string; unit_id?: string | null; full_name?: string;
    job_title?: string | null; employee_id?: string | null;
  }) => request<{ user: HrUser }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getPositions: () => request<{ positions: string[] }>('/employees/dictionaries/positions'),
  getUnits: () => request<{ units: Unit[] }>('/units'),
  getManagerCandidates: () => request<{ candidates: ManagerCandidate[] }>('/units/managers/candidates'),
  updateUnit: (id: string, data: { manager_user_id?: string | null }) =>
    request<{ unit: Unit }>(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getEmployees: (p?: { unit_id?: string; search?: string; status?: string }) =>
    request<{ employees: Employee[] }>(`/employees${q(p || {})}`),
  getEmployee: (id: string) => request<{ employee: Employee }>(`/employees/${id}`),
  createEmployee: (data: object) =>
    request<{ employee: Employee }>('/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: object) =>
    request<{ employee: Employee }>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  getTimesheets: (p: { unit_id?: string; year?: number; month?: number }) =>
    request<{ timesheets: object[] }>(`/timesheets${q(p)}`),
  generateTimesheet: (data: { unit_id: string; year: number; month: number }) =>
    request('/timesheets/generate', { method: 'POST', body: JSON.stringify(data) }),
  getTimesheetEntries: (id: string) =>
    request<{ timesheet: object; entries: object[] }>(`/timesheets/${id}/entries`),
  saveTimesheetEntries: (id: string, entries: object[]) =>
    request(`/timesheets/${id}/entries`, { method: 'PUT', body: JSON.stringify({ entries }) }),
  addTimesheetRow: (id: string, data: { full_name: string; position?: string; employee_id?: string }) =>
    request(`/timesheets/${id}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  submitTimesheet: (id: string) => request(`/timesheets/${id}/submit`, { method: 'POST' }),
  approveTimesheet: (id: string) => request(`/timesheets/${id}/approve`, { method: 'POST' }),

  getPayroll: (year: number, month: number, unit_id?: string) =>
    request<{ payroll: object[] }>(`/payroll${q({ year, month, unit_id })}`),
  syncPayroll: (year: number, month: number, unit_id?: string) =>
    request<{ synced: number }>('/payroll/sync', { method: 'POST', body: JSON.stringify({ year, month, unit_id }) }),
  generatePayroll: (year: number, month: number, unit_id?: string) =>
    request('/payroll/generate', { method: 'POST', body: JSON.stringify({ year, month, unit_id }) }),
  updatePayroll: (id: string, data: object) =>
    request<{ payroll: object }>(`/payroll/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdvances: (year: number, month: number) =>
    request<{ advances: object[] }>(`/payroll/advances${q({ year, month })}`),
  createAdvance: (data: object) =>
    request('/payroll/advances', { method: 'POST', body: JSON.stringify(data) }),
  approveAdvance: (id: string, status: string, approved_amount?: number) =>
    request(`/payroll/advances/${id}`, { method: 'PATCH', body: JSON.stringify({ status, approved_amount }) }),

  getVacations: (status?: string) => request<{ vacations: object[]; types: Record<string, string> }>(`/vacations${q({ status })}`),
  createVacation: (data: object) => request('/vacations', { method: 'POST', body: JSON.stringify(data) }),
  approveVacation: (id: string) => request(`/vacations/${id}/approve`, { method: 'POST' }),
  rejectVacation: (id: string) => request(`/vacations/${id}/reject`, { method: 'POST' }),

  getShiftSchedule: (unit_id: string, year: number, month: number) =>
    request<{ schedule: object | null }>(`/shifts${q({ unit_id, year, month })}`),
  generateShiftSchedule: (data: object) => request('/shifts/generate', { method: 'POST', body: JSON.stringify(data) }),
  saveShiftSchedule: (id: string, schedule_data: object) =>
    request(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify({ schedule_data }) }),
  publishShiftSchedule: (id: string) => request(`/shifts/${id}/publish`, { method: 'POST' }),

  getOnboardingTasks: (p?: { employee_id?: string; status?: string }) =>
    request<{ tasks: object[] }>(`/onboarding${q(p || {})}`),
  startOnboarding: (employee_id: string, task_type?: string) =>
    request('/onboarding/start', { method: 'POST', body: JSON.stringify({ employee_id, task_type }) }),
  completeTask: (id: string) => request(`/onboarding/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'done' }) }),

  getViolations: () => request<{ violations: object[] }>('/disciplinary'),
  getViolationTypes: () => request<{ types: Record<string, { label: string; amount: number }> }>('/disciplinary/types'),
  createViolation: (data: object) => request('/disciplinary', { method: 'POST', body: JSON.stringify(data) }),

  getAnalytics: (year: number, month: number) =>
    request<object>(`/analytics/dashboard${q({ year, month })}`),

  getDocuments: (employee_id?: string) => request<{ documents: object[] }>(`/documents${q({ employee_id })}`),
  createDocument: (data: object) => request('/documents', { method: 'POST', body: JSON.stringify(data) }),
};
