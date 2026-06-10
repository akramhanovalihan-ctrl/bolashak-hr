import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Documents() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ doc_type: 'order', title: '', content: '' });

  useEffect(() => { api.getDocuments().then(({ documents }) => setDocs(documents)); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createDocument(form);
    setShowForm(false);
    api.getDocuments().then(({ documents }) => setDocs(documents));
  };

  return (
    <div>
      <h1 className="page-title">Документы</h1>
      <p className="page-subtitle">Приказы, договоры, шаблоны</p>
      <div className="card">
        <div className="card-header">
          <span>{docs.length} документов</span>
          {(user?.role === 'admin' || user?.role === 'hr' || user?.role === 'manager') &&
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Создать</button>}
        </div>
        <table className="data-table">
          <thead><tr><th>Тип</th><th>Название</th><th>Сотрудник</th><th>Дата</th></tr></thead>
          <tbody>
            {docs.map((d: any) => (
              <tr key={d.id}>
                <td>{d.doc_type}</td><td>{d.title}</td>
                <td>{d.full_name || '—'}</td><td>{d.created_at?.slice(0, 10)}</td>
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
                </select>
              </div>
              <div className="form-group"><label>Название</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group"><label>Текст</label>
                <textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
