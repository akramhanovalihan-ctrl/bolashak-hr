import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Portal() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);

  useEffect(() => { api.getPortalDashboard().then(setData); }, []);

  if (!data) return <div className="empty-state">Загрузка...</div>;

  const { profile, onboarding, pending_onboarding, documents, vacation_requests, company } = data;

  return (
    <div>
      <h1 className="page-title">Портал сотрудника</h1>
      <p className="page-subtitle">{company.name} · {company.tagline}</p>

      <div className="modules-grid" style={{ marginBottom: 20 }}>
        <div className="module-card active">
          <h3>{profile.full_name}</h3>
          <p>{profile.position || '—'} · {profile.unit_name || '—'}</p>
        </div>
        <div className="module-card">
          <h3>{profile.vacation_days_balance ?? '—'}</h3>
          <p>Дней отпуска</p>
        </div>
        <div className="module-card">
          <h3>{pending_onboarding}</h3>
          <p>Задач онбординга</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><strong>Мои задачи онбординга</strong>
          <Link to="/onboarding" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Все задачи</Link>
        </div>
        {onboarding.length === 0 ? (
          <div className="empty-state">Нет активных задач</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Задача</th><th>Срок</th><th>Статус</th></tr></thead>
            <tbody>
              {onboarding.slice(0, 5).map((t: any) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.due_date}</td>
                  <td>{t.status === 'done' ? '✓' : 'Ожидает'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><strong>Документы для меня</strong>
          <Link to="/documents" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Все</Link>
        </div>
        {documents.length === 0 ? (
          <div className="empty-state">Нет опубликованных документов</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Название</th><th>Тип</th><th>Дата</th></tr></thead>
            <tbody>
              {documents.map((d: any) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{d.doc_type}</td>
                  <td>{(d.published_at || d.created_at)?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {user?.role === 'employee' && vacation_requests.length > 0 && (
        <div className="card">
          <div className="card-header"><strong>Мои заявки на отпуск</strong>
            <Link to="/vacations" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Отпуска</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Период</th><th>Статус</th></tr></thead>
            <tbody>
              {vacation_requests.map((v: any) => (
                <tr key={v.id}>
                  <td>{v.start_date} — {v.end_date}</td>
                  <td>{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <Link to="/org-chart" className="btn btn-primary">Оргструктура</Link>
        <Link to="/vacations" className="btn btn-secondary">Подать заявку на отпуск</Link>
      </div>
    </div>
  );
}
