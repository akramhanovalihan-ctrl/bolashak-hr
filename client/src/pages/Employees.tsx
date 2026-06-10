import { FormEvent, useEffect, useState } from 'react';
import { api, type Employee, type Unit } from '../api/client';
import { useAuth } from '../context/AuthContext';
import TableScroll from '../components/TableScroll';

const EMPLOYMENT_LABELS: Record<string, string> = {
  full: 'Полная ставка', part: 'Неполная', hourly: 'Почасовая', contractor: 'ГПХ',
};
const GENDER_LABELS: Record<string, string> = { male: 'Мужской', female: 'Женский' };
const MARITAL_LABELS: Record<string, string> = {
  single: 'Холост/не замужем', married: 'Женат/замужем', divorced: 'Разведён(а)', widowed: 'Вдовец/вдова',
};
const STAFF_LABELS: Record<string, string> = {
  manager: 'Руководитель', specialist: 'Специалист', worker: 'Рабочий',
};
const SCHEDULE_LABELS: Record<string, string> = {
  shift: 'Сменный', shift_mixed: 'Смешанный', standard_5_2: 'Стандарт 5/2', flexible: 'Гибкий',
};
const EDUCATION_LABELS: Record<string, string> = {
  secondary: 'Среднее', vocational: 'Среднее спец.', bachelor: 'Высшее (бак.)',
  master: 'Магистратура', phd: 'Учёная степень',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Активен', on_leave: 'В отпуске', terminated: 'Уволен',
};

type FormTab = 'personal' | 'documents' | 'employment' | 'contacts' | 'extra';

type FormState = {
  full_name: string; birth_date: string; iin: string; gender: string; citizenship: string;
  marital_status: string; address: string; personal_email: string; work_email: string;
  id_document_number: string; id_document_issued_by: string; id_document_issued_date: string;
  unit_id: string; position: string; employee_number: string; contract_number: string;
  employment_type: string; staff_category: string; work_schedule: string;
  salary: string; hourly_rate: string; hire_date: string; probation_end_date: string;
  termination_date: string; termination_reason: string; vacation_days_balance: string;
  phone: string; telegram_username: string; emergency_contact: string;
  bank_name: string; bank_account: string;
  education_level: string; education_specialty: string;
  has_children: boolean; children_count: string; disability_group: string;
  notes: string; status: string;
};

const EMPTY_FORM = (): FormState => ({
  full_name: '', birth_date: '', iin: '', gender: '', citizenship: 'Казахстан',
  marital_status: '', address: '', personal_email: '', work_email: '',
  id_document_number: '', id_document_issued_by: '', id_document_issued_date: '',
  unit_id: '', position: '', employee_number: '', contract_number: '',
  employment_type: 'full', staff_category: 'specialist', work_schedule: '',
  salary: '', hourly_rate: '', hire_date: new Date().toISOString().slice(0, 10),
  probation_end_date: '', termination_date: '', termination_reason: '', vacation_days_balance: '24',
  phone: '', telegram_username: '', emergency_contact: '',
  bank_name: '', bank_account: '',
  education_level: '', education_specialty: '',
  has_children: false, children_count: '', disability_group: '',
  notes: '', status: 'active',
});

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function employeeToForm(emp: Employee): FormState {
  return {
    full_name: emp.full_name || '',
    birth_date: emp.birth_date?.slice(0, 10) || '',
    iin: emp.iin || '',
    gender: emp.gender || '',
    citizenship: emp.citizenship || 'Казахстан',
    marital_status: emp.marital_status || '',
    address: emp.address || '',
    personal_email: emp.personal_email || '',
    work_email: emp.work_email || '',
    id_document_number: emp.id_document_number || '',
    id_document_issued_by: emp.id_document_issued_by || '',
    id_document_issued_date: emp.id_document_issued_date?.slice(0, 10) || '',
    unit_id: emp.unit_id || '',
    position: emp.position || '',
    employee_number: emp.employee_number || '',
    contract_number: emp.contract_number || '',
    employment_type: emp.employment_type || 'full',
    staff_category: emp.staff_category || 'specialist',
    work_schedule: emp.work_schedule || '',
    salary: emp.salary != null ? String(emp.salary) : '',
    hourly_rate: emp.hourly_rate != null ? String(emp.hourly_rate) : '',
    hire_date: emp.hire_date?.slice(0, 10) || '',
    probation_end_date: emp.probation_end_date?.slice(0, 10) || '',
    termination_date: emp.termination_date?.slice(0, 10) || '',
    termination_reason: emp.termination_reason || '',
    vacation_days_balance: emp.vacation_days_balance != null ? String(emp.vacation_days_balance) : '24',
    phone: emp.phone || '',
    telegram_username: emp.telegram_username || '',
    emergency_contact: emp.emergency_contact || '',
    bank_name: emp.bank_name || '',
    bank_account: emp.bank_account || '',
    education_level: emp.education_level || '',
    education_specialty: emp.education_specialty || '',
    has_children: Boolean(emp.has_children),
    children_count: emp.children_count != null ? String(emp.children_count) : '',
    disability_group: emp.disability_group != null ? String(emp.disability_group) : '',
    notes: emp.notes || '',
    status: emp.status || 'active',
  };
}

function formToPayload(form: FormState) {
  const opt = (v: string) => v || undefined;
  const num = (v: string) => (v ? Number(v) : undefined);
  return {
    full_name: form.full_name,
    birth_date: form.birth_date,
    iin: opt(form.iin),
    gender: opt(form.gender),
    citizenship: opt(form.citizenship),
    marital_status: opt(form.marital_status),
    address: opt(form.address),
    personal_email: opt(form.personal_email),
    work_email: opt(form.work_email),
    id_document_number: opt(form.id_document_number),
    id_document_issued_by: opt(form.id_document_issued_by),
    id_document_issued_date: opt(form.id_document_issued_date),
    unit_id: form.unit_id,
    position: form.position,
    employee_number: opt(form.employee_number),
    contract_number: opt(form.contract_number),
    employment_type: form.employment_type,
    staff_category: opt(form.staff_category),
    work_schedule: opt(form.work_schedule),
    salary: num(form.salary),
    hourly_rate: num(form.hourly_rate),
    hire_date: form.hire_date,
    probation_end_date: opt(form.probation_end_date),
    termination_date: opt(form.termination_date),
    termination_reason: opt(form.termination_reason),
    vacation_days_balance: num(form.vacation_days_balance),
    phone: opt(form.phone),
    telegram_username: opt(form.telegram_username),
    emergency_contact: opt(form.emergency_contact),
    bank_name: opt(form.bank_name),
    bank_account: opt(form.bank_account),
    education_level: opt(form.education_level),
    education_specialty: opt(form.education_specialty),
    has_children: form.has_children,
    children_count: num(form.children_count),
    disability_group: num(form.disability_group),
    notes: opt(form.notes),
    status: form.status,
  };
}

const TABS: { id: FormTab; label: string }[] = [
  { id: 'personal', label: 'Личные' },
  { id: 'documents', label: 'Документы' },
  { id: 'employment', label: 'Трудовые' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'extra', label: 'Образование' },
];

export default function Employees() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'hr';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM());
  const [activeTab, setActiveTab] = useState<FormTab>('personal');

  const loadData = async (searchTerm = search) => {
    setLoading(true);
    setError('');
    try {
      const [empRes, unitsRes, posRes] = await Promise.all([
        api.getEmployees({ unit_id: unitFilter || undefined, search: searchTerm.trim() || undefined }),
        api.getUnits(),
        api.getPositions(),
      ]);
      setEmployees(empRes.employees);
      setUnits(unitsRes.units);
      setPositions(posRes.positions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 300);
    return () => clearTimeout(timer);
  }, [unitFilter, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM());
    setActiveTab('personal');
    setShowForm(true);
    setError('');
  };

  const openEdit = async (emp: Employee) => {
    setDetailLoading(true);
    try {
      const { employee } = await api.getEmployee(emp.id);
      setEditingId(employee.id);
      setForm(employeeToForm(employee));
      setActiveTab('personal');
      setShowForm(true);
      setSelected(null);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = async (emp: Employee) => {
    setDetailLoading(true);
    try {
      const { employee } = await api.getEmployee(emp.id);
      setSelected(employee);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSearch = (e: FormEvent) => { e.preventDefault(); loadData(); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = formToPayload(form);
      if (editingId) {
        await api.updateEmployee(editingId, payload);
      } else {
        await api.createEmployee(payload);
      }
      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div>
      <h1 className="page-title">База сотрудников</h1>
      <p className="page-subtitle">Полная HR-карточка сотрудника — автономная система без 1С</p>

      <div className="card">
        <div className="card-header">
          <form className="filters" onSubmit={handleSearch}>
            <input type="search" placeholder="Поиск по ФИО или таб. №..." value={search}
              onChange={(e) => setSearch(e.target.value)} />
            <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Все подразделения</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button type="submit" className="btn btn-secondary">Найти</button>
          </form>
          {canEdit && (
            <button className="btn btn-primary" onClick={openCreate}>+ Добавить сотрудника</button>
          )}
        </div>

        {error && <div className="error-msg" style={{ margin: 16 }}>{error}</div>}
        {detailLoading && <div className="empty-state">Загрузка карточки...</div>}

        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : employees.length === 0 ? (
          <div className="empty-state">Сотрудников пока нет. {canEdit && 'Добавьте первого.'}</div>
        ) : (
          <TableScroll>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Таб. №</th><th>ФИО</th><th>Дата рожд.</th><th>Должность</th>
                  <th>Подразделение</th><th>Категория</th><th>Дата приёма</th><th>Телефон</th><th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="clickable-row" onClick={() => openDetail(emp)}>
                    <td>{emp.employee_number || '—'}</td>
                    <td><strong>{emp.full_name}</strong></td>
                    <td>{formatDate(emp.birth_date)}</td>
                    <td>{emp.position}</td>
                    <td>{emp.unit_name}</td>
                    <td>{STAFF_LABELS[emp.staff_category || ''] || '—'}</td>
                    <td>{formatDate(emp.hire_date)}</td>
                    <td>{emp.phone || '—'}</td>
                    <td>{STATUS_LABELS[emp.status] || emp.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Редактирование сотрудника' : 'Новый сотрудник'}</h2>
            <div className="form-tabs">
              {TABS.map((t) => (
                <button key={t.id} type="button"
                  className={`form-tab ${activeTab === t.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <form onSubmit={handleSubmit}>
              {activeTab === 'personal' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>ФИО *</label>
                      <input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Дата рождения *</label>
                      <input type="date" value={form.birth_date} onChange={(e) => set({ birth_date: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Пол</label>
                      <select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                        <option value="">—</option>
                        <option value="male">Мужской</option>
                        <option value="female">Женский</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Гражданство</label>
                      <input value={form.citizenship} onChange={(e) => set({ citizenship: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Семейное положение</label>
                      <select value={form.marital_status} onChange={(e) => set({ marital_status: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(MARITAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>ИИН</label>
                      <input value={form.iin} maxLength={12}
                        onChange={(e) => set({ iin: e.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="12 цифр" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Адрес проживания</label>
                    <input value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Город, улица, дом" />
                  </div>
                </>
              )}

              {activeTab === 'documents' && (
                <>
                  <div className="form-group">
                    <label>Номер удостоверения / паспорта</label>
                    <input value={form.id_document_number} onChange={(e) => set({ id_document_number: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Кем выдан</label>
                    <input value={form.id_document_issued_by} onChange={(e) => set({ id_document_issued_by: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Дата выдачи</label>
                    <input type="date" value={form.id_document_issued_date}
                      onChange={(e) => set({ id_document_issued_date: e.target.value })} />
                  </div>
                  <p className="form-hint">Сканы документов прикрепляются в модуле «Документы»</p>
                </>
              )}

              {activeTab === 'employment' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Табельный номер</label>
                      <input value={form.employee_number} onChange={(e) => set({ employee_number: e.target.value })}
                        placeholder="Создаётся автоматически" readOnly={!editingId} />
                      <p className="form-hint">Внутренний ID в системе (как в 1С). Заполняется автоматически при создании.</p>
                    </div>
                    <div className="form-group">
                      <label>№ трудового договора</label>
                      <input value={form.contract_number} onChange={(e) => set({ contract_number: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Подразделение *</label>
                      <select value={form.unit_id} onChange={(e) => set({ unit_id: e.target.value })} required>
                        <option value="">Выберите...</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}{u.manager_name ? ` — ${u.manager_name}` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Должность *</label>
                      <input list="positions-list" value={form.position}
                        onChange={(e) => set({ position: e.target.value })} required />
                      <datalist id="positions-list">
                        {positions.map((p) => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Категория персонала</label>
                      <select value={form.staff_category} onChange={(e) => set({ staff_category: e.target.value })}>
                        {Object.entries(STAFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Тип занятости</label>
                      <select value={form.employment_type} onChange={(e) => set({ employment_type: e.target.value })}>
                        {Object.entries(EMPLOYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>График работы</label>
                      <select value={form.work_schedule} onChange={(e) => set({ work_schedule: e.target.value })}>
                        <option value="">По подразделению</option>
                        {Object.entries(SCHEDULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>{form.employment_type === 'hourly' ? 'Ставка (₸/ч)' : 'Оклад (₸)'}</label>
                      {form.employment_type === 'hourly' ? (
                        <input type="number" value={form.hourly_rate} onChange={(e) => set({ hourly_rate: e.target.value })} />
                      ) : (
                        <input type="number" value={form.salary} onChange={(e) => set({ salary: e.target.value })} />
                      )}
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Дата приёма *</label>
                      <input type="date" value={form.hire_date} onChange={(e) => set({ hire_date: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label>Испытательный срок до</label>
                      <input type="date" value={form.probation_end_date} onChange={(e) => set({ probation_end_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Остаток отпуска (дней)</label>
                      <input type="number" step="0.5" value={form.vacation_days_balance}
                        onChange={(e) => set({ vacation_days_balance: e.target.value })} />
                    </div>
                    {editingId && (
                      <div className="form-group">
                        <label>Статус</label>
                        <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {editingId && form.status === 'terminated' && (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Дата увольнения</label>
                        <input type="date" value={form.termination_date} onChange={(e) => set({ termination_date: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label>Причина увольнения</label>
                        <input value={form.termination_reason} onChange={(e) => set({ termination_reason: e.target.value })} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'contacts' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Телефон</label>
                      <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+7 ..." />
                    </div>
                    <div className="form-group">
                      <label>Telegram</label>
                      <input value={form.telegram_username} onChange={(e) => set({ telegram_username: e.target.value })} placeholder="@username" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email личный</label>
                      <input type="email" value={form.personal_email} onChange={(e) => set({ personal_email: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Email рабочий</label>
                      <input type="email" value={form.work_email} onChange={(e) => set({ work_email: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Экстренный контакт</label>
                    <input value={form.emergency_contact} onChange={(e) => set({ emergency_contact: e.target.value })}
                      placeholder="ФИО и телефон близкого человека" />
                  </div>
                  <div className="form-section">Банковские реквизиты для ЗП</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Банк</label>
                      <input value={form.bank_name} onChange={(e) => set({ bank_name: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>IBAN / счёт</label>
                      <input value={form.bank_account} onChange={(e) => set({ bank_account: e.target.value })} placeholder="KZ..." />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'extra' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Уровень образования</label>
                      <select value={form.education_level} onChange={(e) => set({ education_level: e.target.value })}>
                        <option value="">—</option>
                        {Object.entries(EDUCATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Специальность</label>
                      <input value={form.education_specialty} onChange={(e) => set({ education_specialty: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-section">Льготы и семья</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>
                        <input type="checkbox" checked={form.has_children}
                          onChange={(e) => set({ has_children: e.target.checked })} style={{ marginRight: 8 }} />
                        Есть дети
                      </label>
                    </div>
                    <div className="form-group">
                      <label>Количество детей</label>
                      <input type="number" min="0" value={form.children_count}
                        onChange={(e) => set({ children_count: e.target.value })} disabled={!form.has_children} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Группа инвалидности (0 — нет)</label>
                    <select value={form.disability_group} onChange={(e) => set({ disability_group: e.target.value })}>
                      <option value="">Нет</option>
                      <option value="1">1 группа</option>
                      <option value="2">2 группа</option>
                      <option value="3">3 группа</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Примечания HR</label>
                    <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.full_name}</h2>
            <p className="form-hint" style={{ marginBottom: 12 }}>
              {selected.position} · {selected.unit_name} · {STATUS_LABELS[selected.status] || selected.status}
            </p>

            <div className="form-section">Личные данные</div>
            <div className="detail-grid">
              <Detail label="Табельный №" value={selected.employee_number} />
              <Detail label="Дата рождения" value={formatDate(selected.birth_date)} />
              <Detail label="ИИН" value={selected.iin} />
              <Detail label="Пол" value={GENDER_LABELS[selected.gender || ''] || selected.gender} />
              <Detail label="Гражданство" value={selected.citizenship} />
              <Detail label="Семейное положение" value={MARITAL_LABELS[selected.marital_status || ''] || selected.marital_status} />
              <Detail label="Адрес" value={selected.address} span={2} />
            </div>

            <div className="form-section">Документы</div>
            <div className="detail-grid">
              <Detail label="Удостоверение" value={selected.id_document_number} />
              <Detail label="Кем выдан" value={selected.id_document_issued_by} />
              <Detail label="Дата выдачи" value={formatDate(selected.id_document_issued_date)} />
              <Detail label="№ договора" value={selected.contract_number} />
            </div>

            <div className="form-section">Трудовые</div>
            <div className="detail-grid">
              <Detail label="Категория" value={STAFF_LABELS[selected.staff_category || ''] || selected.staff_category} />
              <Detail label="Тип занятости" value={EMPLOYMENT_LABELS[selected.employment_type] || selected.employment_type} />
              <Detail label="График" value={SCHEDULE_LABELS[selected.work_schedule || ''] || 'По подразделению'} />
              <Detail label="Оклад / ставка" value={
                selected.employment_type === 'hourly' && selected.hourly_rate
                  ? `${Number(selected.hourly_rate).toLocaleString('ru-RU')} ₸/ч`
                  : selected.salary ? `${Number(selected.salary).toLocaleString('ru-RU')} ₸` : undefined
              } />
              <Detail label="Дата приёма" value={formatDate(selected.hire_date)} />
              <Detail label="Испытательный срок" value={formatDate(selected.probation_end_date)} />
              <Detail label="Остаток отпуска" value={selected.vacation_days_balance != null ? `${selected.vacation_days_balance} дн.` : undefined} />
              {selected.status === 'terminated' && (
                <>
                  <Detail label="Дата увольнения" value={formatDate(selected.termination_date)} />
                  <Detail label="Причина" value={selected.termination_reason} />
                </>
              )}
            </div>

            <div className="form-section">Контакты и банк</div>
            <div className="detail-grid">
              <Detail label="Телефон" value={selected.phone} />
              <Detail label="Telegram" value={selected.telegram_username} />
              <Detail label="Email личный" value={selected.personal_email} />
              <Detail label="Email рабочий" value={selected.work_email} />
              <Detail label="Экстренный контакт" value={selected.emergency_contact} span={2} />
              <Detail label="Банк" value={selected.bank_name} />
              <Detail label="IBAN" value={selected.bank_account} />
            </div>

            <div className="form-section">Образование и льготы</div>
            <div className="detail-grid">
              <Detail label="Образование" value={EDUCATION_LABELS[selected.education_level || ''] || selected.education_level} />
              <Detail label="Специальность" value={selected.education_specialty} />
              <Detail label="Дети" value={selected.has_children ? `${selected.children_count || '—'} чел.` : 'Нет'} />
              <Detail label="Инвалидность" value={selected.disability_group ? `${selected.disability_group} гр.` : 'Нет'} />
              {selected.notes && <Detail label="Примечания" value={selected.notes} span={2} />}
            </div>

            <div className="modal-actions">
              {canEdit && (
                <button type="button" className="btn btn-primary" onClick={() => openEdit(selected)}>
                  Редактировать
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, span }: { label: string; value?: string | null; span?: number }) {
  return (
    <div className="detail-item" style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label>{label}</label>
      <span>{value || '—'}</span>
    </div>
  );
}
