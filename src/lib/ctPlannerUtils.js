export function keyFor(viewYear, viewMonth, day) {
  const dt = new Date(viewYear, viewMonth, day);
  return dt.toISOString().slice(0,10);
}

export function countEventsInWeekOf(viewYear, viewMonth, day, eventsMap, assignments = []) {
  const start = new Date(viewYear, viewMonth, day - 3);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = d.toISOString().slice(0,10);
    count += (eventsMap[key] || []).length;
  }
  let assignCount = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    assignCount += (assignments || []).filter(a => (a.due || '').slice(0,10) === iso).length;
  }
  return count + assignCount;
}
