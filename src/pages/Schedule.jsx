import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Settings2, Clock3, PencilLine, Copy, CalendarDays, X } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey, getRoutinePreviewDate, isRoutineHoliday, getTermTimeline } from '../store/store';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4 };

const TIME_MODELS = {
  '50min': {
    id: '50min',
    name: '50 Minute Model',
    note: '8:00 start, lunch gap, lab slots supported',
    slots: [
      '8:00 AM-8:50 AM',
      '8:50 AM-9:40 AM',
      '9:40 AM-10:30 AM',
      '10:30 AM-10:40 AM break',
      '10:40 AM-11:30 AM',
      '11:30 AM-12:20 PM',
      '12:20 PM-1:10 PM',
      '1:10 PM-2:30 PM break',
      '2:30 PM-3:20 PM',
      '3:20 PM-4:10 PM',
      '4:10 PM-5:00 PM',
      '2:30 PM-5:00 PM',
    ],
  },
  '40min': {
    id: '40min',
    name: '40 Minute Model',
    note: '9:00 start, shorter class cycle, lab slots supported',
    slots: [
      '9:00 AM-9:40 AM',
      '9:40 AM-10:20 AM',
      '10:20 AM-11:00 AM',
      '11:00 AM-11:40 AM',
      '11:40 AM-12:20 PM',
      '12:20 PM-1:00 PM',
      '1:00 PM-2:00 PM break',
      '2:00 PM-2:40 PM',
      '2:40 PM-3:20 PM',
      '3:20 PM-4:00 PM',
      '2:00 PM-5:00 PM',
    ],
  },
};

const DEFAULT_CUSTOM = [
  '8:00 AM-8:50 AM',
  '8:50 AM-9:40 AM',
  '9:40 AM-10:30 AM',
  '10:30 AM-10:40 AM break',
  '10:40 AM-11:30 AM',
  '11:30 AM-12:20 PM',
  '12:20 PM-1:10 PM',
  '1:10 PM-2:30 PM break',
  '2:30 PM-3:20 PM',
  '3:20 PM-4:10 PM',
  '4:10 PM-5:00 PM',
];

const DEFAULT_SETTINGS = {
  modelId: '50min',
  customSlots: DEFAULT_CUSTOM,
  customLabel: '',
  messageFormat: 'whatsapp',
};

const MESSAGE_FORMATS = [
  { id: 'plain', label: 'Plain', sample: 'Schedule for Sunday' },
  { id: 'whatsapp', label: 'WhatsApp', sample: '*Schedule for Sunday*' },
  { id: 'telegram', label: 'Telegram', sample: 'Schedule for Sunday' },
];

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

const normalizeScheduleEntries = (entries) => {
  const seen = new Set();
  return (entries || []).map(item => ({
    ...item,
    teacherName: normalizeTeacherName(item.teacherName),
    displayName: String(item.displayName || '').trim(),
  })).filter(item => {
    const key = [item.day, item.slot, item.courseId, item.teacherName || '', item.type || '', item.room || '', item.note || ''].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSettings = (raw) => ({
  ...DEFAULT_SETTINGS,
  ...(raw || {}),
  customSlots: Array.isArray(raw?.customSlots) && raw.customSlots.length ? raw.customSlots : DEFAULT_CUSTOM,
  messageFormat: MESSAGE_FORMATS.some(f => f.id === raw?.messageFormat) ? raw.messageFormat : DEFAULT_SETTINGS.messageFormat,
  holidayDates: Array.isArray(raw?.holidayDates) ? [...new Set(raw.holidayDates)].filter(Boolean).sort() : [],
});

const normalizeSlotKey = (value) => String(value || '').trim();

const dateToDayName = (dateStr) => new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });

const parseTimeToMinutes = (value) => {
  let cleanValue = String(value || '').trim().replace(/\s+break\s*$/i, '').trim();
  const match = cleanValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const parseSlotRange = (slot) => {
  const match = String(slot || '').match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return null;
  
  let startStr = match[1].trim();
  let endStr = match[2].trim();
  
  // Extract AM/PM from end time if present
  const endMeridiem = endStr.match(/\s*(AM|PM)$/i)?.[1];
  
  // If end has AM/PM but start doesn't, apply the same meridiem to start
  if (endMeridiem && !startStr.match(/\s*(AM|PM)$/i)) {
    startStr = `${startStr} ${endMeridiem}`;
  }
  
  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
};

const slotSortValue = (slot) => {
  const range = parseSlotRange(slot);
  return range ? range.start * 1000 + range.end : Number.MAX_SAFE_INTEGER;
};

const getSlotCatalog = (schedule, baseSlots) => {
  const unique = new Map();
  [...(baseSlots || []), ...((schedule || []).map(item => item.slot))].forEach(slot => {
    const key = normalizeSlotKey(slot);
    if (key) unique.set(key, key);
  });
  return [...unique.values()].sort((a, b) => slotSortValue(a) - slotSortValue(b) || a.localeCompare(b));
};

const isSlotOverlap = (a, b) => {
  const rangeA = parseSlotRange(a);
  const rangeB = parseSlotRange(b);
  if (!rangeA || !rangeB) return normalizeSlotKey(a) === normalizeSlotKey(b);
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
};

const formatDayShort = (day) => day.slice(0, 3);

const getTomorrowDay = () => {
  const todayIndex = new Date().getDay();
  for (let step = 1; step <= 7; step++) {
    const idx = (todayIndex + step) % 7;
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx];
    if (DAYS.includes(day)) return day;
  }
  return 'Sunday';
};

const buildDailyText = (day, classes, getCourse, messageFormat = 'plain') => {
  const lines = [];
  if (messageFormat === 'whatsapp') {
    lines.push(`*Schedule for ${day}*`);
  } else if (messageFormat === 'telegram') {
    lines.push(`Schedule for ${day}`);
  } else {
    lines.push(`Schedule for ${day}`);
  }
  if (!classes.length) {
    lines.push('No classes added yet.');
    return lines.join('\n');
  }
  classes
    .slice()
    .sort((a, b) => a.slot.localeCompare(b.slot))
    .forEach(item => {
      const course = getCourse(item.courseId);
      const visibleLabel = item.displayName || course?.name || course?.code || 'Unknown Course';
      const teacherLabel = item.teacherName || 'Teacher not set';
      if (messageFormat === 'whatsapp') {
        lines.push(`• *${item.slot}* · ${visibleLabel} · ${teacherLabel}`);
      } else if (messageFormat === 'telegram') {
        lines.push(`• ${item.slot} · ${visibleLabel} · ${teacherLabel}`);
      } else {
        lines.push(`${item.slot} · ${visibleLabel} · ${teacherLabel}`);
      }
    });
  return lines.join('\n');
};

const getRoutineLabel = (course, item) => {
  if (item.displayName) return item.displayName;
  const courseLabel = course?.name || course?.code || 'Unknown Course';
  const teacherLabel = item.teacherName || 'Teacher not set';
  return `${courseLabel} · ${teacherLabel}`;
};

export default function Schedule() {
  const profile = getProfile();
  const courses = useMemo(() => getAllCourses(profile), [profile.dept, profile.currentTermKey]);
  
  // Filter courses to show only current term courses
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(() => {
    if (!currentTermKey) return courses;
    // Extract year and term from key (e.g., 'Y1T1' => year=1, term=1)
    const match = currentTermKey.match(/Y(\d)T(\d)/);
    if (!match) return courses;
    const [, year, term] = match.map(Number);
    return courses.filter(c => c.year === year && c.term === term);
  }, [courses, currentTermKey]);
  const [schedule, setSchedule] = useState(() => normalizeScheduleEntries(store.get('schedule') || []));
  const [settings, setSettings] = useState(() => normalizeSettings(store.get('scheduleSettings')));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => dateToDayName(getRoutinePreviewDate((store.get('scheduleSettings')?.holidayDates) || [])));
  const [holidaySetupOpen, setHolidaySetupOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const autoPreviewDayRef = useRef(getTomorrowDay());
  const [form, setForm] = useState({
    day: 'Sunday',
    slot: TIME_MODELS['50min'].slots[0],
    courseId: '',
    displayName: '',
    room: '',
    teacherName: '',
    type: 'Theory',
    note: '',
  });

  // Quick cell form state (for double-click shortcut)
  const [quickFormOpen, setQuickFormOpen] = useState(false);
  const [quickFormData, setQuickFormData] = useState({ day: '', slot: '', courseId: '', teacherName: '', room: '', note: '', type: 'Theory' });
  const [quickFormEditingId, setQuickFormEditingId] = useState(null);
  
  // Track double-click/double-tap
  const lastClickRef = useRef({});
  
  const openQuickAdd = (day, slot) => {
    setQuickFormEditingId(null);
    setQuickFormData({
      day: day || 'Sunday',
      slot: slot || TIME_MODELS['50min'].slots[0],
      courseId: '',
      teacherName: '',
      room: '',
      note: '',
      type: 'Theory',
    });
    setQuickFormOpen(true);
  };

  const handleCellClick = (id, item) => {
    const now = Date.now();
    const lastClick = lastClickRef.current[id] || 0;
    
    if (now - lastClick < 300) {
      // Double click detected!
      startEdit(item);
      lastClickRef.current[id] = 0; // Reset
    } else {
      lastClickRef.current[id] = now;
    }
  };

  const handleEmptyCellClick = (day, slot) => {
    const key = `empty-${day}-${slot}`;
    const now = Date.now();
    const lastClick = lastClickRef.current[key] || 0;

    if (now - lastClick < 300) {
      openQuickAdd(day, slot);
      lastClickRef.current[key] = 0;
    } else {
      lastClickRef.current[key] = now;
    }
  };

  const activeTemplate = TIME_MODELS[settings.modelId] || TIME_MODELS['50min'];
  const slotList = settings.modelId === 'custom' ? settings.customSlots : activeTemplate.slots;
  const holidayDates = settings.holidayDates || [];

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const autoPreviewDate = useMemo(
    () => getRoutinePreviewDate(holidayDates, new Date(nowTick)),
    [holidayDates, nowTick]
  );
  const autoPreviewDay = useMemo(
    () => dateToDayName(autoPreviewDate),
    [autoPreviewDate]
  );

  useEffect(() => {
    const previousAutoPreviewDay = autoPreviewDayRef.current;
    autoPreviewDayRef.current = autoPreviewDay;
    setSelectedDay(current => (current === previousAutoPreviewDay ? autoPreviewDay : current));
  }, [autoPreviewDay]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const autoDisplayName = (courseId, teacherName) => {
    const course = getCourse(courseId);
    const base = course ? `${course.code} — ${course.name}` : '';
    const teacher = normalizeTeacherName(teacherName) ? ` · ${normalizeTeacherName(teacherName)}` : '';
    return `${base}${teacher}`.trim();
  };

  const persistSettings = (next) => {
    const normalized = normalizeSettings(next);
    setSettings(normalized);
    store.set('scheduleSettings', normalized);
  };

  const resetForm = () => setForm({
    day: 'Sunday',
    slot: TIME_MODELS['50min'].slots[0],
    courseId: '',
    displayName: '',
    room: '',
    teacherName: '',
    type: 'Theory',
    note: '',
  });

  const startEdit = (item) => {
    setQuickFormEditingId(item.id);
    setQuickFormData({
      day: item.day || 'Sunday',
      slot: item.slot || TIME_MODELS['50min'].slots[0],
      courseId: item.courseId || '',
      teacherName: item.teacherName || '',
      room: item.room || '',
      note: item.note || '',
      type: item.type || 'Theory',
    });
    setQuickFormOpen(true);
  };

  const cancelEdit = () => {
    setAdding(false);
    setEditingId(null);
    resetForm();
  };

  const closeQuickForm = () => {
    setQuickFormOpen(false);
    setQuickFormEditingId(null);
    setQuickFormData({ day: '', slot: '', courseId: '', teacherName: '', room: '', note: '', type: 'Theory' });
  };

  const saveQuickForm = () => {
    const { day, slot, courseId, teacherName, room, note, type } = quickFormData;
    
    if (!courseId || !slot) {
      alert('Please select a course and time');
      return;
    }

    const nextSlot = normalizeSlotKey(slot);
    const normalizedTeacher = normalizeTeacherName(teacherName);

    const nextEntry = {
      day,
      slot: nextSlot,
      courseId,
      displayName: '',
      room,
      teacherName: normalizedTeacher,
      type,
      note,
      id: quickFormEditingId || uid()
    };

    // Check for overlaps/duplicates (same as in add function)
    const hasExactDuplicate = schedule.some(item =>
      item.id !== quickFormEditingId &&
      item.day === nextEntry.day &&
      normalizeSlotKey(item.slot) === nextSlot &&
      item.courseId === nextEntry.courseId &&
      (item.teacherName || '') === (nextEntry.teacherName || '') &&
      (item.type || '') === (nextEntry.type || '')
    );

    if (hasExactDuplicate && !quickFormEditingId) {
      alert('This class is already saved.');
      return;
    }

    const hasOverlap = schedule.some(item => 
      item.id !== quickFormEditingId && 
      item.day === nextEntry.day && 
      isSlotOverlap(item.slot, nextSlot)
    );

    if (hasOverlap) {
      alert('That time overlaps with an existing class on the same day.');
      return;
    }

    const updated = quickFormEditingId
      ? normalizeScheduleEntries(schedule.map(item => item.id === quickFormEditingId ? nextEntry : item))
      : normalizeScheduleEntries([...schedule, nextEntry]);

    setSchedule(updated);
    store.set('schedule', updated);
    closeQuickForm();
  };

  const add = () => {
    if (!form.courseId || !form.slot) return;
    const nextSlot = normalizeSlotKey(form.slot);
    
    // Support multiple teachers (comma or semicolon separated)
    // e.g., "Dr. Smith, Dr. Jones" or "Dr. Smith; Dr. Jones"
    const teacherInputs = form.teacherName
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => normalizeTeacherName(t));
    
    // If no teachers specified, create one entry without teacher
    const teachers = teacherInputs.length > 0 ? teacherInputs : [''];
    
    // Create entries for each teacher
    const newEntries = teachers.map(teacherName => ({
      ...form,
      teacherName,
      displayName: form.displayName || autoDisplayName(form.courseId, teacherName),
      slot: nextSlot,
      id: uid()
    }));

    // Check for duplicates and overlaps for each new entry
    for (const nextEntry of newEntries) {
      const hasExactDuplicate = schedule.some(item =>
        item.id !== editingId &&
        item.day === nextEntry.day &&
        normalizeSlotKey(item.slot) === nextSlot &&
        item.courseId === nextEntry.courseId &&
        (item.teacherName || '') === (nextEntry.teacherName || '') &&
        (item.type || '') === (nextEntry.type || '') &&
        (item.room || '') === (nextEntry.room || '')
      );
      if (hasExactDuplicate) {
        alert(`This class is already saved for ${nextEntry.teacherName || 'this teacher'} in the same day and time.`);
        return;
      }

      const hasOverlap = schedule.some(item => item.id !== editingId && item.day === nextEntry.day && isSlotOverlap(item.slot, nextSlot));
      if (hasOverlap) {
        alert('That time overlaps with an existing class on the same day.');
        return;
      }
    }

    // If editing, replace the single entry; if adding, append all new entries
    const updated = editingId
      ? normalizeScheduleEntries(schedule.map(item => item.id === editingId ? { ...newEntries[0], id: editingId } : item))
      : normalizeScheduleEntries([...schedule, ...newEntries]);
    
    setSchedule(updated);
    store.set('schedule', updated);
    cancelEdit();
  };

  const remove = (id) => {
    const updated = normalizeScheduleEntries(schedule.filter(s => s.id !== id));
    setSchedule(updated);
    store.set('schedule', updated);
    if (editingId === id) cancelEdit();
  };

  const exportRoutine = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      schedule: normalizeScheduleEntries(schedule),
      scheduleSettings: settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kuetx-routine-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage('Routine exported successfully.');
  };

  const importRoutine = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const nextSchedule = normalizeScheduleEntries(Array.isArray(payload.schedule) ? payload.schedule : []);
      const nextSettings = normalizeSettings(payload.scheduleSettings || {});
      setSchedule(nextSchedule);
      setSettings(nextSettings);
      store.set('schedule', nextSchedule);
      store.set('scheduleSettings', nextSettings);
      setImportMessage(`Imported ${nextSchedule.length} class${nextSchedule.length === 1 ? '' : 'es'}.`);
    } catch {
      setImportMessage('Import failed. Please use a valid routine JSON file.');
    }
  };

  const getCourse = (id) => courses.find(c => c.id === id);

  const grid = useMemo(() => {
    const next = {};
    DAYS.forEach(d => {
      next[d] = {};
      getSlotCatalog(schedule, slotList).forEach(slot => { next[d][slot] = []; });
    });
    schedule.forEach(s => {
      const key = normalizeSlotKey(s.slot);
      if (next[s.day]?.[key]) next[s.day][key].push(s);
    });
    return next;
  }, [schedule, slotList]);

  const todayIndex = new Date().getDay();
  const today = DAYS[todayIndex] || 'Sunday';
  const todayClasses = schedule.filter(s => s.day === today);
  const selectedClasses = schedule.filter(s => s.day === selectedDay);
  const currentCalendarDay = dateToDayName(new Date().toISOString().split('T')[0]);
  const selectedFormatLabel = MESSAGE_FORMATS.find(format => format.id === settings.messageFormat)?.label || 'Plain';
  const selectedScheduleText = buildDailyText(selectedDay, selectedClasses, getCourse, settings.messageFormat);

  const saveHolidayDates = (nextDates) => {
    persistSettings({ ...settings, holidayDates: [...new Set(nextDates)].sort() });
  };

  const addHolidayDate = () => {
    if (!holidayDate) return;
    if (isRoutineHoliday(holidayDate, holidayDates)) {
      saveHolidayDates([...holidayDates, holidayDate]);
      setHolidayDate('');
      return;
    }
    saveHolidayDates([...holidayDates, holidayDate]);
    setHolidayDate('');
  };

  const removeHolidayDate = (value) => {
    saveHolidayDates(holidayDates.filter(date => date !== value));
  };

  const copySelectedSchedule = async () => {
    try {
      await navigator.clipboard.writeText(selectedScheduleText);
    } catch {
      // no-op
    }
  };

  // Exam overrides stored per-term: { [termKey]: [{ course: 1, examDate: 'YYYY-MM-DD' }, ...] }
  const [examOverrides, setExamOverrides] = useState(() => store.get('examOverrides') || {});
  const [editingExams, setEditingExams] = useState(false);
  const [localExamEdits, setLocalExamEdits] = useState([]);

  const slotPreview = (slot) => {
    const cleanSlot = String(slot).replace(/\s+break\s*$/i, '').trim();
    const match = cleanSlot.match(/^(.+)-(.+)$/);
    if (!match) return cleanSlot;
    return `${match[1]} → ${match[2]}`;
  };

  const isBreakSlot = (slot) => String(slot).toLowerCase().includes('break');

  const editCustomSlots = (text) => {
    const slots = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    persistSettings({ ...settings, modelId: 'custom', customSlots: slots.length ? slots : DEFAULT_CUSTOM });
  };

  const currentSettingsText = slotList.join('\n');
  const showSettingsPanel = editingSettings;
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  const renderTimetable = (opts = {}) => {
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: opts.large ? 15 : 13 };
    return (
      <div className={`timetable-grid${opts.fullView ? ' full-view' : ''}`} style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th className="time-col" style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 110, textAlign: 'left' }}>Time</th>
              {DAYS.map(d => (
                <th key={d} className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: 160 }}>
                  <button
                    onClick={() => setSelectedDay(d)}
                    style={{
                      width: '100%',
                      padding: '12px 12px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontWeight: d === selectedDay || d === today ? 700 : 500,
                      color: d === selectedDay || d === today ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {formatDayShort(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {getSlotCatalog(schedule, slotList).map(p => {
              const breakSlot = isBreakSlot(p);
              return (
                <tr key={p}>
                  <td style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)' }}>{slotPreview(p)}</td>
                  {DAYS.map(d => {
                    const dayItems = grid[d]?.[p] || [];
                    return (
                      <td
                        key={d}
                        className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`}
                        onClick={dayItems.length === 0 ? () => handleEmptyCellClick(d, p) : undefined}
                        title={dayItems.length === 0 ? 'Double-click to add class' : undefined}
                        style={{
                          padding: '6px',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          verticalAlign: 'top',
                          minHeight: 54,
                          background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                          cursor: dayItems.length === 0 ? 'pointer' : 'default',
                        }}
                      >
                        {dayItems.map(s => {
                          const c = getCourse(s.courseId);
                          return (
                            <div 
                              key={s.id} 
                              onClick={() => handleCellClick(s.id, s)}
                              title="Double-click to edit" 
                              style={{
                                padding: '8px 9px', borderRadius: 11, fontSize: 12, lineHeight: 1.35, marginBottom: 4,
                                background: 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.08))',
                                border: '1px solid rgba(59,130,246,0.18)', color: 'var(--text)', position: 'relative', cursor: 'pointer',
                                userSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                              }}
                            >
                            <div style={{ fontWeight: 700, fontSize: 12, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.displayName || c?.name || c?.code || '?'}</div>
                            <div style={{ opacity: 0.88, fontSize: 11, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.teacherName || 'Teacher not set'}</div>
                            <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} style={{
                              position: 'absolute', top: 2, right: 16, background: 'none', border: 'none',
                              color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                              touchAction: 'manipulation',
                            }}>✎</button>
                            <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} style={{
                              position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                              color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                              touchAction: 'manipulation',
                            }}>×</button>
                          </div>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="page-enter page-container" style={{ maxWidth: 1180, margin: '0 auto', paddingBottom: 24 }}>
      <div className="card" style={{ marginBottom: 14, padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Class Schedule</h1>
              <span className="tag tag-blue">5-day week</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, maxWidth: 620 }}>
              Minimal routine builder for Sun–Thu classes. Keep the display clean, choose the share format, then copy or import/export the full routine when needed.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setEditingSettings(v => !v)}>
              <Settings2 size={13} /> Settings
            </button>
            <button className="btn btn-ghost" onClick={() => setHolidaySetupOpen(v => !v)}>
              <CalendarDays size={13} /> Holiday Setup
            </button>
            <button className="btn btn-primary" onClick={() => { setEditingId(null); resetForm(); setAdding(true); }}>
              <Plus size={13} /> Add Class
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginBottom: 14 }}>
        {showSettingsPanel && (
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 1 }}>Routine Settings</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{activeTemplate.name} · {activeTemplate.note}</div>
              </div>
              <span className="tag tag-gray">{settings.modelId === 'custom' ? 'Custom' : activeTemplate.id}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
              {Object.values(TIME_MODELS).map(model => (
                <button
                  key={model.id}
                  onClick={() => persistSettings({ ...settings, modelId: model.id })}
                  className="btn"
                  style={{
                    justifyContent: 'flex-start',
                    border: settings.modelId === model.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: settings.modelId === model.id ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock3 size={13} /> {model.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{model.note}</span>
                  </div>
                </button>
              ))}
              <button
                onClick={() => persistSettings({ ...settings, modelId: 'custom' })}
                className="btn"
                style={{
                  justifyContent: 'flex-start',
                  border: settings.modelId === 'custom' ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: settings.modelId === 'custom' ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                  padding: '10px 12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <PencilLine size={13} /> Custom model
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Paste one slot per line</span>
                </div>
              </button>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Copy format</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MESSAGE_FORMATS.map(format => (
                  <button
                    key={format.id}
                    onClick={() => persistSettings({ ...settings, messageFormat: format.id })}
                    className="btn"
                    style={{
                      padding: '8px 12px',
                      border: settings.messageFormat === format.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: settings.messageFormat === format.id ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                    }}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            {settings.modelId === 'custom' && (
              <div>
                <label>Custom slots</label>
                <textarea
                  rows={6}
                  value={currentSettingsText}
                  onChange={e => editCustomSlots(e.target.value)}
                  placeholder={DEFAULT_CUSTOM.join('\n')}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            )}

            <div style={{ marginTop: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Holiday Calendar</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Friday and Saturday are always holidays. Add extra dates below.</div>
                </div>
                <button className="btn btn-ghost" onClick={() => setHolidaySetupOpen(v => !v)}>
                  {holidaySetupOpen ? 'Hide Calendar' : 'Open Calendar'}
                </button>
              </div>

              {holidaySetupOpen && (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={e => setHolidayDate(e.target.value)}
                      style={{ minWidth: 170 }}
                    />
                    <button className="btn btn-primary" onClick={addHolidayDate} disabled={!holidayDate}>
                      <CalendarDays size={13} /> Add Holiday
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {holidayDates.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>No extra holidays added yet.</div>
                    ) : holidayDates.map(date => (
                      <span key={date} className="tag tag-gray" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        {date}
                        <button onClick={() => removeHolidayDate(date)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <div className="card day-preview-panel" style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Day Preview</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Select a day to see only that day’s routine.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="tag tag-blue">Today · {currentCalendarDay}</span>
            <span className="tag tag-green">Selected · {selectedDay}</span>
            <span className="tag tag-gray">Auto · {autoPreviewDay}</span>
            <button
              className="btn"
              onClick={copySelectedSchedule}
              style={{
                justifyContent: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 999,
                border: selectedFormatLabel === 'WhatsApp' ? '1px solid rgba(37,211,102,0.35)' : '1px solid rgba(59,130,246,0.24)',
                background: selectedFormatLabel === 'WhatsApp'
                  ? 'linear-gradient(180deg, rgba(37,211,102,0.16), rgba(37,211,102,0.10))'
                  : 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))',
                boxShadow: selectedFormatLabel === 'WhatsApp'
                  ? '0 10px 24px rgba(37,211,102,0.12)'
                  : '0 10px 24px rgba(59,130,246,0.08)',
                color: 'var(--text)',
                fontWeight: 700,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: selectedFormatLabel === 'WhatsApp' ? 'rgba(37,211,102,0.18)' : 'rgba(59,130,246,0.14)' }}>
                <Copy size={12} />
              </span>
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
                <span style={{ fontSize: 12 }}>Copy {selectedFormatLabel}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>selected format</span>
              </span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className="btn"
              style={{
                padding: '8px 12px',
                border: selectedDay === day ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: selectedDay === day ? 'rgba(59,130,246,0.08)' : 'var(--card)',
              }}
            >
              {day}
            </button>
          ))}
        </div>
        <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{selectedDay} routine</div>
          {selectedClasses.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>No classes added yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {selectedClasses.slice().sort((a, b) => a.slot.localeCompare(b.slot)).map(item => {
                const course = getCourse(item.courseId);
                const courseCode = course?.code || 'Unknown';
                const courseName = course?.name || 'Course';
                const teacherName = item.teacherName || 'Teacher not set';
                const timeRange = item.slot;
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--card)' }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent)', lineHeight: 1.3 }}>{timeRange}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{courseCode}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, lineHeight: 1.3 }}>{courseName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', opacity: 0.8 }}>→ {teacherName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <div className="card" style={{ marginBottom: 14, borderColor: 'var(--accent)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{editingId ? 'Edit Class Slot' : 'Add Class Slot'}</div>
            {editingId && <span className="tag tag-blue">Editing</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, padding: '8px 12px', background: 'rgba(59,130,246,0.05)', borderRadius: 6, borderLeft: '3px solid var(--accent)' }}>
            💡 <strong>Multi-teacher courses:</strong> Enter multiple teacher names separated by comma or semicolon (e.g., "Dr. Smith, Dr. Jones") to add entries for all teachers at once.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 10 }}>
            <div>
              <label>Day</label>
              <select value={form.day} onChange={e => set('day', e.target.value)}>
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label>Time</label>
              <select value={form.slot} onChange={e => set('slot', e.target.value)}>
                {slotList.map(p => <option key={p} value={p}>{slotPreview(p)}</option>)}
              </select>
            </div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="Theory">Theory</option>
                <option value="Sessional">Lab / Sessional</option>
                <option value="Project">Project</option>
                <option value="Tutorial">Tutorial / Section</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label>Course</label>
              <select value={form.courseId} onChange={e => set('courseId', e.target.value)}>
                <option value="">Select course</option>
                {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label>Show as</label>
              <input
                value={form.displayName}
                onChange={e => set('displayName', e.target.value)}
                placeholder={autoDisplayName(form.courseId, form.teacherName) || 'CSE 2201 — Data Structures · Imran Sir'}
              />
            </div>
            <div>
              <label>Teacher(s)</label>
              <input value={form.teacherName} onChange={e => {
                const input = e.target.value;
                set('teacherName', input);
                // Auto-update display name if only one teacher
                if (!form.displayName && !input.includes(',') && !input.includes(';')) {
                  const teacherName = normalizeTeacherName(input);
                  set('displayName', autoDisplayName(form.courseId, teacherName));
                }
              }} placeholder="Dr. Smith or Dr. Smith, Dr. Jones" />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Comma or semicolon separated for multiple</div>
            </div>
            <div>
              <label>Room</label>
              <input value={form.room} onChange={e => set('room', e.target.value)} placeholder="Room 301" />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <label>Note</label>
              <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional note, teacher, batch, etc." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={add}>{editingId ? 'Save Changes' : 'Add'}</button>
            <button className="btn btn-ghost" onClick={cancelEdit}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Timetable Grid</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Double-click any entry to edit.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
            {schedule.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{schedule.length} saved slot{schedule.length === 1 ? '' : 's'}</div>
            )}
            <button className="btn btn-ghost mobile-fullscreen-btn" onClick={() => setFullScreenOpen(true)} aria-label="Open timetable full screen">
              <span className="fs-icon" aria-hidden style={{ display: 'inline-block', lineHeight: 0 }}>
                ⤢
              </span>
              <span className="fs-label" style={{ marginLeft: 8, fontWeight: 700 }}>Full</span>
            </button>
          </div>
        </div>
        <div className="mobile-preview-controls">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span className="tag tag-blue">Today · {currentCalendarDay}</span>
            <span className="tag tag-green">Selected · {selectedDay}</span>
            <span className="tag tag-gray">Auto · {autoPreviewDay}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className="btn"
                style={{
                  padding: '8px 12px',
                  border: selectedDay === day ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedDay === day ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                }}
              >
                {day}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {selectedClasses.length === 0 ? 'No classes added yet.' : `${selectedClasses.length} class${selectedClasses.length === 1 ? '' : 'es'} selected`}
            </div>
            <button className="btn btn-ghost" onClick={copySelectedSchedule}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: selectedFormatLabel === 'WhatsApp' ? 'rgba(37,211,102,0.18)' : 'rgba(59,130,246,0.14)' }}>
                <Copy size={12} />
              </span>
              <span style={{ marginLeft: 8, fontWeight: 700 }}>Copy {selectedFormatLabel}</span>
            </button>
          </div>
        </div>
        
        {renderTimetable()}
      </div>
      {fullScreenOpen && (
        <div className="fullscreen-overlay" onClick={() => setFullScreenOpen(false)}>
          <div className="fullscreen-content fullscreen-rotated" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Timetable Full View</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Double-click any entry to edit.</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setFullScreenOpen(false)}>Close</button>
            </div>
            {renderTimetable({ large: true, fullView: true })}
          </div>
        </div>
      )}
      <div className="card" style={{ marginTop: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Routine Share</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Copy text in the selected format or share/import the full routine JSON.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            onClick={copySelectedSchedule}
            style={{
              justifyContent: 'center',
              minWidth: 160,
              padding: '10px 14px',
              borderRadius: 999,
              border: selectedFormatLabel === 'WhatsApp' ? '1px solid rgba(37,211,102,0.35)' : '1px solid var(--border)',
              background: selectedFormatLabel === 'WhatsApp' ? 'linear-gradient(180deg, rgba(37,211,102,0.16), rgba(37,211,102,0.10))' : 'var(--card)',
              color: 'var(--text)',
              fontWeight: 700,
            }}
          >
            <Copy size={13} /> Copy {selectedFormatLabel}
          </button>
          <button className="btn btn-ghost" onClick={exportRoutine} style={{ justifyContent: 'center', minWidth: 140, padding: '10px 14px' }}>Export routine</button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer', justifyContent: 'center', minWidth: 140, padding: '10px 14px' }}>
            Import routine
            <input
              type="file"
              accept="application/json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                importRoutine(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {importMessage && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{importMessage}</div>}
      </div>
      {/* === Detailed Term Roadmap (bottom of Schedule page) === */}
      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Term Roadmap (Detailed)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Approximate timeline with manual override and holiday sync. Use Edit to adjust exam dates.</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => {
              // open holiday setup
              setHolidaySetupOpen(v => !v);
            }}>
              <CalendarDays size={13} /> Add Holiday
            </button>
            <button className="btn btn-primary" onClick={() => {
              const termKey = getCurrentTermKey(profile);
              const timeline = getTermTimeline(profile?.termStartDate, profile?.dept, termKey);
              if (!timeline) return alert('Term timeline not available — add term start date in Profile');
              // prepare local edits from existing overrides or timeline
              const overrides = (examOverrides && examOverrides[termKey]) || [];
              const mapped = timeline.examPhases.map((p, i) => ({ course: p.course, examDate: (overrides[i]?.examDate) || p.examDate.toISOString().slice(0,10) }));
              setLocalExamEdits(mapped);
              setEditingExams(true);
            }}>
              <PencilLine size={13} /> Edit Exams
            </button>
          </div>
        </div>

        {(() => {
          const termKey = getCurrentTermKey(profile);
          const timeline = getTermTimeline(profile?.termStartDate, profile?.dept, termKey);
          if (!timeline) {
            return <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add a term start date in Profile to view the detailed roadmap.</div>;
          }

          // apply overrides if present
          const overrides = (examOverrides && examOverrides[termKey]) || [];
          const examPhases = timeline.examPhases.map((p, i) => {
            const o = overrides[i];
            return { ...p, examDate: o && o.examDate ? new Date(o.examDate) : new Date(p.examDate) };
          });

          const format = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{profile?.currentTerm || getCurrentTermKey(profile)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700 }}>📚 Classes & Study</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{format(new Date(profile?.termStartDate || new Date()))} → {format(timeline.classEndDate)} • 65 working days</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700 }}>🎓 Prep Leave</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{format(timeline.prepLeaveStart)} → {format(timeline.prepLeaveEnd)} • 10 days</div>
                </div>
              </div>

              <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 700 }}>✍️ Exam Period</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{examPhases.length} courses: {format(examPhases[0]?.examDate)} → {format(examPhases[examPhases.length - 1]?.examDate)}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6, marginTop: 8 }}>
                  {examPhases.map((ep, idx) => (
                    <div key={idx} style={{ padding: 8, borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>Exam {ep.course}</div>
                      <div style={{ color: 'var(--muted)' }}>{format(ep.examDate)}</div>
                    </div>
                  ))}
                </div>
                {timeline.specialPeriods && timeline.specialPeriods.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#F59E0B' }}>
                    ⚠️ Special holiday blocks during exams:
                    {timeline.specialPeriods.map((sp, i) => (
                      <div key={i}>• {sp.daysCount} days • {new Date(sp.startDate).toLocaleDateString()}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700 }}>🌴 Post-Exam Break</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{format(timeline.postExamBreakStart)} → {format(timeline.postExamBreakEnd)} • 7 days</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700 }}>🚀 Next Semester Starts</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{format(timeline.nextSemesterStart)}</div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Edit Exams Modal */}
      {editingExams && (
        <div className="card" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ width: 720, maxWidth: '95%', background: 'var(--bg)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Edit Exam Dates</div>
              <button className="btn btn-ghost" onClick={() => setEditingExams(false)}>Close</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {localExamEdits.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ width: 90, fontWeight: 700 }}>Exam {e.course}</div>
                  <input type="date" value={e.examDate} onChange={ev => {
                    const v = ev.target.value;
                    setLocalExamEdits(prev => prev.map((p, idx) => idx === i ? { ...p, examDate: v } : p));
                  }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditingExams(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => {
                  const termKey = getCurrentTermKey(profile);
                  const next = { ...(examOverrides || {}) };
                  next[termKey] = localExamEdits.map(x => ({ course: x.course, examDate: x.examDate }));
                  setExamOverrides(next);
                  store.set('examOverrides', next);
                  setEditingExams(false);
                }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Form Modal */}
      {quickFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 12,
        }} onClick={closeQuickForm}>
          <div style={{
            background: 'var(--card)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: 20,
            maxWidth: 400,
            width: '100%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              {quickFormEditingId ? 'Quick Edit' : 'Quick Add'} · {quickFormData.day} · {slotPreview(quickFormData.slot)}
            </div>
            
            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              {/* Course */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Course</label>
                <select
                  value={quickFormData.courseId}
                  onChange={e => setQuickFormData(d => ({ ...d, courseId: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="">Select course</option>
                  {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>

              {/* Type */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
                <select
                  value={quickFormData.type}
                  onChange={e => setQuickFormData(d => ({ ...d, type: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="Theory">Theory</option>
                  <option value="Sessional">Lab / Sessional</option>
                  <option value="Project">Project</option>
                  <option value="Tutorial">Tutorial / Section</option>
                </select>
              </div>

              {/* Teacher */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Teacher</label>
                <input
                  type="text"
                  value={quickFormData.teacherName}
                  onChange={e => setQuickFormData(d => ({ ...d, teacherName: e.target.value }))}
                  placeholder="Teacher name"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* Room */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Room</label>
                <input
                  type="text"
                  value={quickFormData.room}
                  onChange={e => setQuickFormData(d => ({ ...d, room: e.target.value }))}
                  placeholder="Room number"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              {/* Note */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Note</label>
                <input
                  type="text"
                  value={quickFormData.note}
                  onChange={e => setQuickFormData(d => ({ ...d, note: e.target.value }))}
                  placeholder="Optional note"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={closeQuickForm}
                className="btn btn-ghost"
                style={{ padding: '8px 14px' }}
              >
                Cancel
              </button>
              <button
                onClick={saveQuickForm}
                className="btn btn-primary"
                style={{ padding: '8px 14px' }}
              >
                {quickFormEditingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
