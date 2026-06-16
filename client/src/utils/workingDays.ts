/** Календарные дни в периоде, включительно (для заявок на отпуск) */
export function calcCalendarDays(dateFrom: string, dateTo: string): number {
  if (!dateFrom || !dateTo) return 0;
  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

/** Рабочие дни (пн–пт) в периоде, включительно */
export function calcWorkingDays(dateFrom: string, dateTo: string): number {
  if (!dateFrom || !dateTo) return 0;
  const start = new Date(`${dateFrom}T12:00:00`);
  const end = new Date(`${dateTo}T12:00:00`);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
