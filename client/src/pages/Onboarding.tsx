import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  hr: 'HR', manager: 'Руководитель', it: 'IT', finance: 'Финансы',
};

export default function Onboarding() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [empId, setEmpId] = useState('');
  const [tab, setTab] = useState<'tasks' | 'templates'>('tasks');
  const [newTpl, setNewTpl] = useState({ task_type: 'onboard', title: '', responsible_role: 'hr' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const canStart = user?.role === 'admin' || user?.role === 'hr';
  const canComplete = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const canEditTemplates = user?.role === 'admin' || user?.role === 'hr';

  const loadTasks = (employeeId?: string) => {
    setLoading(true);
    api.getOnboardingTasks({ employee_id: employeeId || undefined })
      .then(({ tasks: t }) => setTasks(t))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
    if (canStart || canComplete) {
      api.getEmployees().then(({ employees: e }) => setEmployees(e));
    }
    if (canEditTemplates) {
      api.getOnboardingTemplates().then(({ templates: t }) => setTemplates(t));
    }
  }, [user?.role]);

  const start = async (type: string) => {
    setError('');
    if (!empId) {
      setError('Выберите сотрудника в списке — нельзя запустить для «Все сотрудники».');
      return;
    }
    setStarting(true);
    try {
      await api.startOnboarding(empId, type);
      loadTasks(empId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запустить');
    } finally {
      setStarting(false);
    }
  };

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createOnboardingTemplate(newTpl);
    setNewTpl({ task_type: 'onboard', title: '', responsible_role: 'hr' });
    api.getOnboardingTemplates().then(({ templates: t }) => setTemplates(t));
  };

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const pendingCount = tasks.length - doneCount;

  return (
    <div>
      <h1 className="page-title">Онбординг / Офбординг</h1>
      <p className="page-subtitle">Чеклисты при приёме и увольнении · автозапуск при добавлении сотрудника</p>

      {canEditTemplates && (
        <div className="page-tabs">
          <button type="button" className={`btn ${tab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('tasks')}>
            Задачи
          </button>
          <button type="button" className={`btn ${tab === 'templates' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('templates')}>
            Шаблоны
          </button>
        </div>
      )}

      {tab === 'templates' && canEditTemplates ? (
        <div className="card">
          <div className="card-header"><strong>Шаблоны чеклистов</strong></div>
          <TableScroll>
            <table className="data-table">
              <thead><tr><th>Тип</th><th>Задача</th><th>Ответственный</th><th></th></tr></thead>
              <tbody>
                {templates.filter((t) => t.is_active !== 0).map((t: any) => (
                  <tr key={t.id}>
                    <td>{t.task_type === 'onboard' ? 'Приём' : 'Увольнение'}</td>
                    <td>{t.title}</td>
                    <td>{ROLE_LABELS[t.responsible_role] || t.responsible_role}</td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => api.deleteOnboardingTemplate(t.id).then(() => api.getOnboardingTemplates().then(({ templates: tl }) => setTemplates(tl)))}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <form onSubmit={addTemplate} className="toolbar" style={{ padding: 16 }}>
            <select value={newTpl.task_type} onChange={(e) => setNewTpl({ ...newTpl, task_type: e.target.value })}>
              <option value="onboard">Онбординг</option>
              <option value="offboard">Офбординг</option>
            </select>
            <input placeholder="Название задачи" value={newTpl.title} onChange={(e) => setNewTpl({ ...newTpl, title: e.target.value })} required style={{ flex: 1, minWidth: 200 }} />
            <select value={newTpl.responsible_role} onChange={(e) => setNewTpl({ ...newTpl, responsible_role: e.target.value })}>
              <option value="hr">HR</option>
              <option value="manager">Руководитель</option>
              <option value="it">IT</option>
              <option value="finance">Финансы</option>
            </select>
            <button type="submit" className="btn btn-primary">Добавить</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="toolbar">
              <select
                value={empId}
                onChange={(e) => {
                  setEmpId(e.target.value);
                  setError('');
                  loadTasks(e.target.value || undefined);
                }}
              >
                <option value="">Все сотрудники</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select>
              {tasks.length > 0 && (
                <span className="form-hint" style={{ margin: 0 }}>
                  {pendingCount} ожидает · {doneCount} выполнено
                </span>
              )}
            </div>
            {canStart && (
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!empId || starting}
                  onClick={() => start('onboard')}
                >
                  {starting ? 'Запуск...' : 'Запустить онбординг'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!empId || starting}
                  onClick={() => start('offboard')}
                >
                  Запустить офбординг
                </button>
              </div>
            )}
          </div>

          {error && <div className="error-msg" style={{ margin: '12px 20px 0' }}>{error}</div>}

          {canStart && !empId && (
            <p className="form-hint" style={{ padding: '12px 20px 0', margin: 0 }}>
              Выберите сотрудника, чтобы запустить чеклист или отфильтровать задачи.
            </p>
          )}

          {loading ? (
            <div className="empty-state">Загрузка...</div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              Задач пока нет.
              {canStart && ' Выберите сотрудника и нажмите «Запустить онбординг», или добавьте нового в разделе «База сотрудников» — чеклист создастся автоматически.'}
            </div>
          ) : (
            <TableScroll>
              <table className="data-table">
                <thead>
                  <tr><th>Задача</th><th>Сотрудник</th><th>Ответственный</th><th>Срок</th><th>Статус</th><th></th></tr>
                </thead>
                <tbody>
                  {tasks.map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.title}</td>
                      <td>{t.full_name}</td>
                      <td>{ROLE_LABELS[t.responsible_role] || t.responsible_role || '—'}</td>
                      <td>{t.due_date}</td>
                      <td>
                        <span className={`status-pill ${t.status === 'done' ? 'published' : 'draft'}`}>
                          {t.status === 'done' ? 'Выполнено' : 'Ожидает'}
                        </span>
                      </td>
                      <td>
                        {t.status === 'pending' && canComplete && (
                          <button type="button" className="btn btn-secondary btn-sm"
                            onClick={() => api.completeTask(t.id).then(() => loadTasks(empId || undefined))}>
                            Готово
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </div>
      )}
    </div>
  );
}
