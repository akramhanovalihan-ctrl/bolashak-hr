import TableScroll from '../components/TableScroll';
import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [empId, setEmpId] = useState('');
  const [tab, setTab] = useState<'tasks' | 'templates'>('tasks');
  const [newTpl, setNewTpl] = useState({ task_type: 'onboard', title: '', responsible_role: 'hr' });

  useEffect(() => {
    api.getOnboardingTasks().then(({ tasks }) => setTasks(tasks));
    if (user?.role === 'admin' || user?.role === 'hr') {
      api.getEmployees().then(({ employees }) => setEmployees(employees));
      api.getOnboardingTemplates().then(({ templates: t }) => setTemplates(t));
    }
  }, [user?.role]);

  const start = async (type: string) => {
    if (!empId) return alert('Выберите сотрудника');
    await api.startOnboarding(empId, type);
    api.getOnboardingTasks({ employee_id: empId }).then(({ tasks }) => setTasks(tasks));
  };

  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const canEditTemplates = user?.role === 'admin' || user?.role === 'hr';

  const addTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createOnboardingTemplate(newTpl);
    setNewTpl({ task_type: 'onboard', title: '', responsible_role: 'hr' });
    api.getOnboardingTemplates().then(({ templates: t }) => setTemplates(t));
  };

  return (
    <div>
      <h1 className="page-title">Онбординг / Офбординг</h1>
      <p className="page-subtitle">Настраиваемые чеклисты · автозапуск при приёме</p>
      {canEditTemplates && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn ${tab === 'tasks' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('tasks')}>Задачи</button>
          <button className={`btn ${tab === 'templates' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('templates')}>Шаблоны</button>
        </div>
      )}
      {tab === 'templates' && canEditTemplates ? (
        <div className="card">
          <div className="card-header"><strong>Шаблоны чеклистов</strong></div>
          <TableScroll><table className="data-table">
            <thead><tr><th>Тип</th><th>Задача</th><th>Ответственный</th><th></th></tr></thead>
            <tbody>
              {templates.filter((t) => t.is_active !== 0).map((t: any) => (
                <tr key={t.id}>
                  <td>{t.task_type}</td><td>{t.title}</td><td>{t.responsible_role}</td>
                  <td><button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => api.deleteOnboardingTemplate(t.id).then(() => api.getOnboardingTemplates().then(({ templates: tl }) => setTemplates(tl)))}>Удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table></TableScroll>
          <form onSubmit={addTemplate} style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
          <select value={empId} onChange={(e) => { setEmpId(e.target.value); api.getOnboardingTasks({ employee_id: e.target.value || undefined }).then(({ tasks }) => setTasks(tasks)); }}>
            <option value="">Все сотрудники</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          {canManage && <>
            <button className="btn btn-primary" onClick={() => start('onboard')}>Запустить онбординг</button>
            <button className="btn btn-secondary" onClick={() => start('offboard')}>Запустить офбординг</button>
          </>}
        </div>
        <TableScroll><table className="data-table">
          <thead><tr><th>Задача</th><th>Сотрудник</th><th>Ответственный</th><th>Срок</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {tasks.map((t: any) => (
              <tr key={t.id}>
                <td>{t.title}</td><td>{t.full_name}</td><td>{t.responsible_role}</td>
                <td>{t.due_date}</td>
                <td>{t.status === 'done' ? '✓ Выполнено' : 'Ожидает'}</td>
                <td>{t.status === 'pending' && canManage &&
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => api.completeTask(t.id).then(() => api.getOnboardingTasks().then(({ tasks }) => setTasks(tasks)))}>Готово</button>}</td>
              </tr>
            ))}
          </tbody>
        </table></TableScroll>
      </div>
      )}
    </div>
  );
}
