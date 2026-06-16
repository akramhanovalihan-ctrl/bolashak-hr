import { useEffect, useState } from 'react';
import { api } from '../api/client';

type OrgNode = {
  name: string;
  role?: string;
  type?: string;
  dept?: string;
  ft?: boolean;
  outsource?: boolean;
  vacancy?: boolean;
  children?: OrgNode[];
};

function isVacancy(node: OrgNode) {
  return /вакансия/i.test(node.name || '') || node.vacancy;
}

function OrgNodeCard({ node, collapsed, onToggle }: {
  node: OrgNode;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const hasChildren = (node.children?.length || 0) > 0;
  const cls = [
    'org-node',
    node.type === 'head' ? 'head' : '',
    node.type === 'exec' ? 'exec' : '',
    node.type === 'dept-head' ? 'dept-head' : '',
    node.outsource ? 'outsource' : '',
    node.dept || '',
    isVacancy(node) ? 'vacancy-node' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {hasChildren && (
        <button type="button" className="org-toggle" onClick={onToggle}>{collapsed ? '+' : '−'}</button>
      )}
      <div className="org-name">{node.name}</div>
      {node.role && <div className="org-role">{node.role}</div>}
      <div className="org-badges">
        {node.ft === false && <span className="org-badge pt">PT</span>}
        {node.ft && !node.outsource && !isVacancy(node) && node.type !== 'head' && <span className="org-badge ft">FT</span>}
        {node.outsource && <span className="org-badge outsource">Аутсорс</span>}
        {isVacancy(node) && <span className="org-badge vacancy">Вакансия</span>}
      </div>
    </div>
  );
}

function OrgBranch({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const children = node.children || [];

  return (
    <div className="org-branch">
      <OrgNodeCard node={node} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      {children.length > 0 && !collapsed && (
        <div className="org-children">
          {children.map((child, i) => (
            <OrgBranch key={`${child.name}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChart() {
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.getOrgChart()
      .then(({ tree: t, stats: s }) => {
        setTree(t as OrgNode);
        setStats(s);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="empty-state">Загрузка оргструктуры...</div>;
  if (error) return <div className="empty-state"><div className="error-msg">{error}</div><button className="btn btn-secondary" onClick={load}>Повторить</button></div>;
  if (!tree) return <div className="empty-state">Нет данных</div>;

  return (
    <div>
      <h1 className="page-title">Организационная структура</h1>
      <p className="page-subtitle">ИП Дюсипов Р.Т. · горизонтальное дерево</p>

      {stats && (
        <div className="org-stats-bar">
          В базе HR: <b>{stats.db_employees}</b> сотрудников
          {stats.vacancy > 0 && <> · Вакансий: <b>{stats.vacancy}</b></>}
        </div>
      )}

      <div className="org-controls">
        <button type="button" className="btn btn-secondary" onClick={() => setExpanded(true)}>Развернуть</button>
        <button type="button" className="btn btn-secondary" onClick={() => setExpanded(false)}>Свернуть</button>
      </div>

      <div className={`org-chart-wrap ${expanded ? 'expanded' : 'collapsed-root'}`}>
        <OrgBranch node={tree} depth={0} />
      </div>
    </div>
  );
}
