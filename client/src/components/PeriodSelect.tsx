interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

const MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

export default function PeriodSelect({ year, month, onChange }: Props) {
  return (
    <div className="filters">
      <select value={month} onChange={(e) => onChange(year, Number(e.target.value))}>
        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </select>
      <select value={year} onChange={(e) => onChange(Number(e.target.value), month)}>
        {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
