import { useEffect, useMemo, useRef, useState } from 'react';
import type { Employee } from '../api/client';

type Props = {
  employees: Employee[];
  value: string;
  onChange: (employeeId: string, employee: Employee | null) => void;
  required?: boolean;
  placeholder?: string;
  excludeIds?: string[];
  disabled?: boolean;
};

export default function EmployeeSelect({
  employees,
  value,
  onChange,
  required,
  placeholder = 'Начните вводить ФИО...',
  excludeIds = [],
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = employees.find((e) => e.id === value);
  const available = employees.filter((e) => !excludeIds.includes(e.id));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? available.filter((e) => e.full_name.toLowerCase().includes(q))
      : available;
    return list.slice(0, 50);
  }, [available, search]);

  useEffect(() => {
    if (selected) setSearch(selected.full_name);
  }, [selected?.id, selected?.full_name]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className={`employee-select${disabled ? ' employee-select-disabled' : ''}`} ref={wrapRef}>
      <input
        type="text"
        className="employee-select-input"
        value={search}
        disabled={disabled}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value.trim()) onChange('', null);
        }}
        onFocus={() => !disabled && setOpen(true)}
        placeholder={placeholder}
        required={required && !value}
        autoComplete="off"
      />
      {open && !disabled && filtered.length > 0 && (
        <ul className="employee-select-list">
          {filtered.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(e.id, e);
                  setSearch(e.full_name);
                  setOpen(false);
                }}
              >
                <span>{e.full_name}</span>
                <span className="employee-select-pos">{e.position}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !disabled && search.trim() && filtered.length === 0 && (
        <div className="employee-select-empty">Сотрудник не найден</div>
      )}
    </div>
  );
}
