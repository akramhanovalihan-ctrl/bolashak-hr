const SHIFT_HOURS = { 'Д': 8, 'В': 8, 'Н': 8, 'Р': 8 };

export function calcHoursFromShiftData(shiftData, scheduleType) {
  if (!shiftData || typeof shiftData !== 'object') return 0;
  if (scheduleType === 'flexible') {
    return Number(shiftData.total_hours) || 0;
  }
  if (scheduleType === 'standard_5_2') {
    const absences = shiftData.absences || [];
    const absentDays = absences.reduce((s, a) => s + (a.days || 0), 0);
    const workDays = 22 - absentDays;
    return Math.max(0, workDays * 8);
  }
  let total = 0;
  for (const code of Object.values(shiftData)) {
    if (SHIFT_HOURS[code]) total += SHIFT_HOURS[code];
  }
  return total;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
