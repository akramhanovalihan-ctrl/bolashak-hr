import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api.getNotifications().then(({ notifications, unread_count }) => {
      setItems(notifications);
      setUnread(unread_count);
    }).catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    load();
  };

  const markAll = async () => {
    await api.markAllNotificationsRead();
    load();
  };

  return (
    <div className="notif-bell" ref={ref}>
      <button type="button" className="notif-btn" onClick={() => { setOpen(!open); if (!open) load(); }} aria-label="Уведомления">
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <strong>Уведомления</strong>
            {unread > 0 && <button type="button" className="btn-link" onClick={markAll}>Прочитать все</button>}
          </div>
          {items.length === 0 ? (
            <div className="notif-empty">Нет уведомлений</div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={n.is_read ? '' : 'unread'}>
                  <div className="notif-title">{n.title}</div>
                  {n.body && <div className="notif-body">{n.body}</div>}
                  <div className="notif-actions">
                    {n.link && <Link to={n.link} onClick={() => { markRead(n.id); setOpen(false); }}>Открыть</Link>}
                    {!n.is_read && <button type="button" className="btn-link" onClick={() => markRead(n.id)}>✓</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
