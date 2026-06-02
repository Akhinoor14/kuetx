export function countWeeklyPressure(schedule = [], assignments = [], centerIso) {
  const center = new Date(centerIso + 'T00:00:00');
  const start = new Date(center);
  start.setDate(center.getDate() - 3);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    count += (schedule || []).filter(s => (s.date || '').slice(0,10) === iso).length;
    count += (assignments || []).filter(a => (a.due || '').slice(0,10) === iso).length;
  }
  return count;
}

export function detectConflicts(schedule = []) {
  const conflicts = [];
  // helper: parse time like '10:00 AM' or '14:30' into a Date for given dateIso
  const parseTime = (dateIso, timeStr) => {
    if (!timeStr) return null;
    const m = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ampm = m[3];
    if (ampm) {
      const up = ampm.toUpperCase();
      if (up === 'PM' && hh < 12) hh += 12;
      if (up === 'AM' && hh === 12) hh = 0;
    }
    const dt = new Date(dateIso + 'T00:00:00');
    dt.setHours(hh, mm, 0, 0);
    return dt;
  };

  const overlap = (a, b) => (a.start < b.end && b.start < a.end);

  // group by teacher+date and detect overlaps when times present
  const byTeacherDate = {};
  (schedule || []).forEach(s => {
    const key = `${s.teacherName || ''}::${(s.date||'').slice(0,10)}`;
    byTeacherDate[key] = byTeacherDate[key] || [];
    byTeacherDate[key].push(s);
  });
  Object.entries(byTeacherDate).forEach(([key, list]) => {
    if (list.length <= 1) return;
    // try precise overlap detection
    const date = key.split('::')[1];
    const prepared = list.map(it => {
      const s = parseTime(date, it.startTime) || new Date(date + 'T00:00:00');
      const e = parseTime(date, it.endTime) || new Date(s.getTime() + (Number(it.duration || 60) * 60000));
      return { id: it.id, start: s, end: e };
    });
    // find overlapping groups
    const overlapped = [];
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        if (overlap(prepared[i], prepared[j])) {
          overlapped.push(prepared[i].id);
          overlapped.push(prepared[j].id);
        }
      }
    }
    const unique = Array.from(new Set(overlapped));
    if (unique.length) conflicts.push({ type: 'teacher', teacher: key.split('::')[0], date, items: unique });
    else conflicts.push({ type: 'teacher', teacher: key.split('::')[0], date, items: list.map(i => i.id) });
  });

  // room conflicts similarly
  const byRoomDate = {};
  (schedule || []).forEach(s => {
    const key = `${s.room||''}::${(s.date||'').slice(0,10)}`;
    if (!s.room) return;
    byRoomDate[key] = byRoomDate[key] || [];
    byRoomDate[key].push(s);
  });
  Object.entries(byRoomDate).forEach(([key, list]) => {
    if (list.length <= 1) return;
    const date = key.split('::')[1];
    const prepared = list.map(it => {
      const s = parseTime(date, it.startTime) || new Date(date + 'T00:00:00');
      const e = parseTime(date, it.endTime) || new Date(s.getTime() + (Number(it.duration || 60) * 60000));
      return { id: it.id, start: s, end: e };
    });
    const overlapped = [];
    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        if (overlap(prepared[i], prepared[j])) {
          overlapped.push(prepared[i].id);
          overlapped.push(prepared[j].id);
        }
      }
    }
    const unique = Array.from(new Set(overlapped));
    if (unique.length) conflicts.push({ type: 'room', room: key.split('::')[0], date, items: unique });
    else conflicts.push({ type: 'room', room: key.split('::')[0], date, items: list.map(i=>i.id) });
  });

  return conflicts;
}

export function generateSuggestions(schedule = [], assignments = [], centerIso, settings = {}) {
  const suggestions = [];
  const pressure = countWeeklyPressure(schedule, assignments, centerIso);
  if (pressure >= 6) suggestions.push('High pressure this week — consider moving one evaluation.');
  if (pressure >= 3 && pressure < 6) suggestions.push('Medium pressure — aim for 3+ days spacing between major evaluations.');

  const conflicts = detectConflicts(schedule);
  conflicts.forEach(c => {
    if (c.type === 'teacher') suggestions.push(`Teacher ${c.teacher} has ${c.items.length} evaluations on ${c.date}.`);
    if (c.type === 'room') suggestions.push(`Room ${c.room} has ${c.items.length} events on ${c.date}.`);
  });

  // assignment proximity suggestions
  const center = new Date(centerIso + 'T00:00:00');
  (assignments || []).forEach(a => {
    if (!a.due) return;
    const due = new Date(a.due + 'T00:00:00');
    const diff = Math.round((due - center) / (1000*60*60*24));
    if (Math.abs(diff) <= 2) suggestions.push(`Assignment '${a.title || a.titles?.[0] || 'Assignment'}' due in ${diff} day(s) — avoid scheduling heavy CTs nearby.`);
  });

  return suggestions.slice(0,6);
}
