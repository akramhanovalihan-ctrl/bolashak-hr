const SHIFT_HOURS = { 'Д': 8, 'В': 8, 'Н': 8, 'Р': 8 };

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function dayKey(day) {
  return String(day).padStart(2, '0');
}

export function buildDefaultShiftData(year, month, scheduleType) {
  const days = getDaysInMonth(year, month);
  const shiftData = { mode: scheduleType };

  if (scheduleType === 'flexible') {
    shiftData.total_hours = 0;
    for (let d = 1; d <= days; d++) shiftData[dayKey(d)] = 0;
    return shiftData;
  }

  if (scheduleType === 'standard_5_2') {
    shiftData.absences = [];
    for (let d = 1; d <= days; d++) {
      const dow = new Date(year, month - 1, d).getDay();
      shiftData[dayKey(d)] = dow === 0 || dow === 6 ? 'В' : 'Д';
    }
    return shiftData;
  }

  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    shiftData[dayKey(d)] = dow === 0 ? 'В' : 'Д';
  }
  return shiftData;
}

function sumDayCodes(shiftData) {
  let total = 0;
  for (const [key, code] of Object.entries(shiftData)) {
    if (/^\d{2}$/.test(key) && SHIFT_HOURS[code]) total += SHIFT_HOURS[code];
  }
  return total;
}

function sumDayHours(shiftData) {
  let total = 0;
  for (const [key, value] of Object.entries(shiftData)) {
    if (/^\d{2}$/.test(key)) total += Number(value) || 0;
  }
  return total;
}

export function calcHoursFromShiftData(shiftData, scheduleType) {
  if (!shiftData || typeof shiftData !== 'object') return 0;

  if (scheduleType === 'flexible') {
    const fromDays = sumDayHours(shiftData);
    if (fromDays > 0) return fromDays;
    return Number(shiftData.total_hours) || 0;
  }

  const fromDays = sumDayCodes(shiftData);
  if (fromDays > 0) return fromDays;

  if (scheduleType === 'standard_5_2') {
    const absences = shiftData.absences || [];
    const absentDays = absences.reduce((s, a) => s + (a.days || 0), 0);
    return Math.max(0, (22 - absentDays) * 8);
  }

  return 0;
}
