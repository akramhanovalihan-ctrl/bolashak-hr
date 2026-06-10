import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const VIS_MODES = [
  { value: 'all', label: 'Все сотрудники' },
  { value: 'roles', label: 'По ролям' },
  { value: 'units', label: 'По подразделениям' },
];

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: 'order', title: '', content: '', visibility_mode: 'all' });
  const [selected, setSelected] = useState<any>(null);

  const load = () => api.getDocuments().then(({ documents }) => setDocs(documents));
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createDocument({
      ...form,
      visibility: { mode: form.visibility_mode },
    });
    setShowForm(false);
    load();
  };

  const publish = async (id: string, mode: string) => {
    await api.publishDocument(id, { mode });
    load();
    setSelected(null);
  };

  const canManage = user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager';
  const canPublish = user?.role === 'admin' || user?.role === 'hr';

  return (
    <div>
      <h1 className="page-title">Документы</h1>
      <p className="page-subtitle">Приказы, договоры · публикация с уведомлениями</p>
      <div className="card">
        <div className="card-header">
          <span>{docs.length} документов</span>
          {canManage && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Создать</button>}
        </div>
        <table className="data-table">
          <thead><tr><th>Тип</th><th>Название</th><th>Статус</th><th>Сотрудник</th><th>Дата</th><th></th></tr></thead>
          <tbody>
            {docs.map((d: any) => (
              <tr key={d.id}>
                <td>{d.doc_type}</td>
                <td>{d.title}</td>
                <td><span className={`status-pill ${d.status}`}>{d.status === 'published' ? 'Опубликован' : 'Черновик'}</span></td>
                <td>{d.full_name || '—'}</td>
                <td>{(d.published_at || d.created_at)?.slice(0, 10)}</td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    onClick={() => setSelected(d)}>Открыть</button>
                  {canPublish && d.status !== 'published' && (
                    <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem', marginLeft: 4 }}
                      onClick={() => publish(d.id, 'all')}>Опубликовать</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новый документ</h2>
            <form onSubmit={submit}>
              <div className="form-group"><label>Тип</label>
                <select value={form.doc_type} onChange={(e) => setForm({ ...form, doc_type: e.target.value })}>
                  <option value="contract">Договор</option>
                  <option value="order">Приказ</option>
                  <option value="template">Шаблон</option>
                  <option value="policy">Политика</option>
                </select>
              </div>
              <div className="form-group"><label>Название</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group"><label>Видимость при публикации</label>
                <select value={form.visibility_mode} onChange={(e) => setForm({ ...form, visibility_mode: e.target.value })}>
                  {VIS_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Текст</label>
                <textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить черновик</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selected.title}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              {selected.doc_type} · {selected.status === 'published' ? 'Опубликован' : 'Черновик'}
            </p>
            <div style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{selected.content || '—'}</div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
