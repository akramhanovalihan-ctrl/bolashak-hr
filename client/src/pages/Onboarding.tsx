import { useEffect, useState } from 'react';
import { api, type Employee } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Onboarding() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empId, setEmpId] = useState('');

  useEffect(() => {
    api.getOnboardingTasks().then(({ tasks }) => setTasks(tasks));
    api.getEmployees().then(({ employees }) => setEmployees(employees));
  }, []);

  const start = async (type: string) => {
    if (!empId) return alert('Выберите сотрудника');
    await api.startOnboarding(empId, type);
    api.getOnboardingTasks({ employee_id: empId }).then(({ tasks }) => setTasks(tasks));
  };

  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';

  return (
    <div>
      <h1 className="page-title">Онбординг / Офбординг</h1>
      <p className="page-subtitle">Чеклисты при приёме и увольнении</p>
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
        <table className="data-table">
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
        </table>
      </div>
    </div>
  );
}
