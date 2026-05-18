import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { store, uid, getAllCourses, getProfile, getCurrentTermKey, getRoutinePreviewDate } from '../store/store';
import CourseTeacherDialog from '../components/CourseTeacherDialog';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

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

const normalizeTeacherName = (value) => {
  const clean = String(value || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bsir\.?$/i.test(clean) ? clean.replace(/\.$/, '') : `${clean} Sir`;
};

const DEFAULT_SETTINGS = {
  modelId: '50min',
  customSlots: DEFAULT_CUSTOM,
  customLabel: '',
  messageFormat: 'whatsapp',
};

const MESSAGE_FORMATS = [
  { id: 'plain', label: 'Copy Text' },
  { id: 'whatsapp', label: 'Copy WhatsApp' },
];

const normalizeSettings = (raw) => ({
  ...DEFAULT_SETTINGS,
  ...(raw || {}),
  customSlots: Array.isArray(raw?.customSlots) && raw.customSlots.length ? raw.customSlots : DEFAULT_CUSTOM,
  messageFormat: MESSAGE_FORMATS.some(f => f.id === raw?.messageFormat) ? raw.messageFormat : DEFAULT_SETTINGS.messageFormat,
  holidayDates: Array.isArray(raw?.holidayDates) ? [...new Set(raw.holidayDates)].filter(Boolean).sort() : [],
  courseTeacherMap: Object.entries(raw?.courseTeacherMap || {}).reduce((acc, [courseId, teachers]) => {
    const normalizedTeachers = [...new Set((Array.isArray(teachers) ? teachers : [])
      .map(name => normalizeTeacherName(name))
      .filter(Boolean))].slice(0, 2);
    if (normalizedTeachers.length > 0) acc[courseId] = normalizedTeachers;
    return acc;
  }, {}),
  courseShortNameMap: Object.entries(raw?.courseShortNameMap || {}).reduce((acc, [courseId, shortName]) => {
    const normalized = String(shortName || '').trim();
    if (normalized) acc[courseId] = normalized;
    return acc;
  }, {}),
});

const getUniqueTeacherNames = (schedule) => {
  const teachers = new Set();
  (schedule || []).forEach(item => {
    if (item.teacherName && item.teacherName.trim()) {
      teachers.add(item.teacherName);
    }
  });
  return Array.from(teachers).sort();
};

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

  if (!/\b(AM|PM)\b/i.test(startStr) && /\b(AM|PM)\b/i.test(endStr)) {
    const ampm = endStr.match(/\b(AM|PM)\b/i)?.[0] || '';
    startStr = `${startStr} ${ampm}`.trim();
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

const isSessionalType = (type) => /sessional|lab/i.test(String(type || ''));

const detectCourseType = (course) => {
  if (!course || !course.code) return 'Theory';
  const match = String(course.code).match(/(\d)(?:\D|$)/);
  if (!match) return 'Theory';
  const lastDigit = Number(match[1]);
  return lastDigit % 2 === 0 ? 'Sessional' : 'Theory';
};

const isLongSessionalSlot = (slot) => {
  const range = parseSlotRange(slot);
  if (!range) return false;
  return (range.end - range.start) >= 120;
};

const getPresetSessionalSlots = (modelId) => {
  if (modelId === '50min') {
    return [
      '8:00 AM-10:30 AM',
      '10:40 AM-1:10 PM',
      '2:30 PM-5:00 PM',
    ];
  }
  if (modelId === '40min') {
    return [
      '9:00 AM-11:00 AM',
      '11:00 AM-1:00 PM',
      '2:00 PM-4:00 PM',
    ];
  }
  return [];
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

const buildDailyText = (day, classes, getCourse, messageFormat = 'whatsapp') => {
  const lines = [];
  const getClassShareLabel = (item) => {
    const course = getCourse(item.courseId);
    return item.displayName || course?.name || course?.code || 'Unknown Course';
  };

  if (messageFormat === 'whatsapp') {
    lines.push(`*_📅 Schedule for ${day}_*`);
    lines.push('');

    if (classes.length) {
      const sortedClasses = classes.slice().sort((a, b) => a.slot.localeCompare(b.slot));
      sortedClasses.forEach((item, idx) => {
        const cleanSlot = String(item.slot).replace(/\s+break\s*$/i, '').trim();
        const classLabel = item.type === 'Sessional' ? getClassShareLabel(item) : (item.teacherName || 'Teacher not set');
        lines.push(`${idx + 1}. *${cleanSlot}* — _${classLabel}_`);
      });
    }
  } else {
    lines.push(`Schedule for ${day}`);
    lines.push('');
    if (classes.length) {
      classes.slice().sort((a, b) => a.slot.localeCompare(b.slot)).forEach((item, idx) => {
        const cleanSlot = String(item.slot).replace(/\s+break\s*$/i, '').trim();
        const course = getCourse(item.courseId);
        lines.push(`${idx + 1}. ${cleanSlot} - ${item.displayName || course?.name || course?.code || 'Unknown Course'}`);
      });
    }
  }

  return lines.join('\n').trim();
};

const buildRoutineBackupPayload = (schedule, scheduleSettings, assignments, teachers) => ({
  version: 1,
  type: 'kuetx-routine-backup',
  exportedAt: new Date().toISOString(),
  data: {
    schedule: normalizeScheduleEntries(schedule),
    scheduleSettings: scheduleSettings || DEFAULT_SETTINGS,
    examOverrides: store.get('examOverrides') || {},
    assignments: assignments || [],
    teachers: teachers || [],
  },
});

export default function ClassManagement() {
  const profile = getProfile();
  const courses = useMemo(() => getAllCourses(profile), [profile.dept, profile.currentTermKey]);
  const currentTermKey = getCurrentTermKey(profile);
  const currentTermCourses = useMemo(() => {
    if (!currentTermKey) return courses;
    const match = currentTermKey.match(/Y(\d)T(\d)/);
    if (!match) return courses;
    const [, year, term] = match.map(Number);
    return courses.filter(c => c.year === year && c.term === term);
  }, [courses, currentTermKey]);

  const [schedule, setSchedule] = useState(() => normalizeScheduleEntries(store.get('schedule') || []));
  const [settings, setSettings] = useState(() => normalizeSettings(store.get('scheduleSettings')));
  const [assignments, setAssignments] = useState(() => store.get('assignments') || []);
  const [teachers, setTeachers] = useState(() => store.get('teachers') || []);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => dateToDayName(getRoutinePreviewDate((store.get('scheduleSettings')?.holidayDates) || [])));
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [quickFormOpen, setQuickFormOpen] = useState(false);
  const [quickFormData, setQuickFormData] = useState({ day: '', slot: '', courseId: '', teacherName: '', displayName: '', room: '', note: '', type: 'Theory' });
  const [quickFormEditingId, setQuickFormEditingId] = useState(null);
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '', source: null });
  const [allKnownTeachers, setAllKnownTeachers] = useState(() => getUniqueTeacherNames(schedule));
  const lastClickRef = useRef({});

  const getCourse = (id) => {
    const allCourses = store.get('courses') || [];
    return allCourses.find(course => course.id === id);
  };

  const activeTemplate = TIME_MODELS[settings.modelId] || TIME_MODELS['50min'];
  const slotList = settings.modelId === 'custom' ? settings.customSlots : activeTemplate.slots;

  const courseTeacherMap = settings.courseTeacherMap || {};
  const courseShortNameMap = settings.courseShortNameMap || {};

  const getCourseTeachers = (courseId) => {
    if (!courseId) return [];
    const mappedTeachers = Array.isArray(courseTeacherMap[courseId]) ? courseTeacherMap[courseId].filter(Boolean) : [];
    if (mappedTeachers.length > 0) return mappedTeachers;

    const fromSchedule = [...new Set(
      (schedule || [])
        .filter(item => item.courseId === courseId)
        .flatMap(item => {
          const many = Array.isArray(item.teacherNames) && item.teacherNames.length > 0 ? item.teacherNames : [item.teacherName];
          return many.map(name => normalizeTeacherName(name)).filter(Boolean);
        })
    )].slice(0, 2);

    return fromSchedule;
  };

  const ensureCourseTeacherSetup = (courseId, source) => {
    if (!courseId) return false;
    const teachers = getCourseTeachers(courseId);
    if (teachers.length >= 2) return true;
    setCourseTeacherDialogState({ open: true, courseId, source });
    return false;
  };

  const updateCourseShortName = (courseId, value) => {
    if (!courseId) return;
    const trimmed = String(value || '').trim();
    const nextMap = { ...(courseShortNameMap || {}) };
    if (trimmed) nextMap[courseId] = trimmed;
    else delete nextMap[courseId];
    const normalized = normalizeSettings({ ...settings, courseShortNameMap: nextMap });
    setSettings(normalized);
    store.set('scheduleSettings', normalized);
  };

  useEffect(() => {
    const teacherSet = new Set(getUniqueTeacherNames(schedule));
    Object.values(courseTeacherMap || {}).forEach(list => {
      (Array.isArray(list) ? list : []).forEach(name => {
        const normalized = normalizeTeacherName(name);
        if (normalized) teacherSet.add(normalized);
      });
    });
    setAllKnownTeachers(Array.from(teacherSet).sort());
  }, [schedule, courseTeacherMap]);

  const autoDisplayName = (courseId, teacherName) => {
    const course = getCourse(courseId);
    const base = course ? `${course.code} — ${course.name}` : '';
    const teacher = normalizeTeacherName(teacherName) ? ` · ${normalizeTeacherName(teacherName)}` : '';
    return `${base}${teacher}`.trim();
  };

  const getAllowedSlotsForType = (type) => {
    if (isSessionalType(type)) {
      const presetSlots = getPresetSessionalSlots(settings.modelId);
      if (presetSlots.length) return presetSlots;
      const sessionalSlots = slotList.filter(isLongSessionalSlot);
      return sessionalSlots.length ? sessionalSlots : slotList;
    }
    const regularSlots = slotList.filter(slot => !isLongSessionalSlot(slot));
    return regularSlots.length ? regularSlots : slotList;
  };

  const openQuickAdd = (day, slot, courseId = '') => {
    setQuickFormEditingId(null);
    const range = parseSlotRange(slot);
    const isLongSlot = range && (range.end - range.start) >= 120;
    const autoType = isLongSlot ? 'Sessional' : 'Theory';

    setQuickFormData({
      day: day || 'Sunday',
      slot: slot || TIME_MODELS['50min'].slots[0],
      courseId: courseId || '',
      teacherName: '',
      displayName: '',
      room: '',
      note: '',
      type: autoType,
    });
    setQuickFormOpen(true);
  };

  const handleQuickCourseChange = (courseId) => {
    const teachersList = getCourseTeachers(courseId);
    const course = getCourse(courseId);
    const detectedType = detectCourseType(course);
    const allowed = getAllowedSlotsForType(detectedType);
    setQuickFormData(prev => ({
      ...prev,
      courseId,
      teacherName: teachersList[0] || '',
      displayName: courseShortNameMap[courseId] || prev.displayName || '',
      type: detectedType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
    }));
  };

  const handleQuickTypeChange = (nextType) => {
    const allowed = getAllowedSlotsForType(nextType);
    setQuickFormData(prev => ({
      ...prev,
      type: nextType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
    }));
  };

  const handleCellClick = (id, item) => {
    const now = Date.now();
    const lastClick = lastClickRef.current[id] || 0;

    if (now - lastClick < 300) {
      startEdit(item);
      lastClickRef.current[id] = 0;
    } else {
      lastClickRef.current[id] = now;
    }
  };

  const handleEmptyCellClick = (day, slot, courseId = '') => {
    const key = `empty-${day}-${slot}`;
    const now = Date.now();
    const lastClick = lastClickRef.current[key] || 0;

    if (now - lastClick < 300) {
      openQuickAdd(day, slot, courseId);
      lastClickRef.current[key] = 0;
    } else {
      lastClickRef.current[key] = now;
    }
  };

  const startEdit = (item) => {
    const courseTeachers = getCourseTeachers(item.courseId);
    setQuickFormEditingId(item.id);
    setQuickFormData({
      day: item.day || 'Sunday',
      slot: item.slot || TIME_MODELS['50min'].slots[0],
      courseId: item.courseId || '',
      teacherName: item.teacherName || courseTeachers[0] || '',
      displayName: item.displayName || courseShortNameMap[item.courseId] || '',
      room: item.room || '',
      note: item.note || '',
      type: item.type || 'Theory',
    });
    setQuickFormOpen(true);
  };

  const closeQuickForm = () => {
    setQuickFormOpen(false);
    setQuickFormEditingId(null);
    setQuickFormData({ day: '', slot: '', courseId: '', teacherName: '', displayName: '', room: '', note: '', type: 'Theory' });
  };

  const handleCourseTeacherDialogClose = () => {
    setCourseTeacherDialogState({ open: false, courseId: '', source: null });
  };

  const handleCourseTeacherDialogSave = (teachersList) => {
    const courseId = courseTeacherDialogState.courseId;
    const normalizedTeachers = [...new Set((teachersList || []).map(name => normalizeTeacherName(name)).filter(Boolean))].slice(0, 2);
    if (!courseId || normalizedTeachers.length < 2) return;

    const nextMap = {
      ...(courseTeacherMap || {}),
      [courseId]: normalizedTeachers,
    };
    const normalized = normalizeSettings({ ...settings, courseTeacherMap: nextMap });
    setSettings(normalized);
    store.set('scheduleSettings', normalized);

    if (courseTeacherDialogState.source === 'quick') {
      setQuickFormData(prev => ({
        ...prev,
        courseId,
        teacherName: prev.teacherName && normalizedTeachers.includes(prev.teacherName) ? prev.teacherName : normalizedTeachers[0],
      }));
    }

    handleCourseTeacherDialogClose();
  };

  const saveQuickForm = () => {
    const { day, slot, courseId, teacherName, displayName, room, note, type } = quickFormData;

    if (!courseId || !slot) {
      alert('Please select a course and time');
      return;
    }

    const allowedSlots = getAllowedSlotsForType(type);
    if (!allowedSlots.includes(slot)) {
      alert(isSessionalType(type)
        ? 'Sessional class must use a long lab slot (for example 2:30 PM-5:00 PM).'
        : 'Theory/project/tutorial should use regular class slots.');
      return;
    }

    const availableTeachers = getCourseTeachers(courseId);
    if (availableTeachers.length < 2) {
      alert('Please set both teachers for this course first.');
      ensureCourseTeacherSetup(courseId, 'quick');
      return;
    }

    const selectedTeacher = normalizeTeacherName(teacherName);
    if (!selectedTeacher) {
      alert('Please select a teacher for this class');
      return;
    }

    const nextSlot = normalizeSlotKey(slot);

    const newEntry = {
      day,
      slot: nextSlot,
      courseId,
      displayName: String(displayName || '').trim() || courseShortNameMap[courseId] || autoDisplayName(courseId, selectedTeacher),
      room,
      teacherNames: availableTeachers,
      teacherName: selectedTeacher,
      type,
      note,
      id: quickFormEditingId || uid(),
    };

    const existingSchedule = schedule.filter(item => item.id !== quickFormEditingId);

    const hasExactDuplicate = existingSchedule.some(item =>
      item.day === newEntry.day &&
      normalizeSlotKey(item.slot) === nextSlot &&
      item.courseId === newEntry.courseId &&
      (item.teacherName || '') === (newEntry.teacherName || '') &&
      (item.type || '') === (newEntry.type || '')
    );

    if (hasExactDuplicate && !quickFormEditingId) {
      alert(`This class is already saved for ${newEntry.teacherName || 'this teacher'}.`);
      return;
    }

    const hasOverlap = existingSchedule.some(item =>
      item.day === newEntry.day &&
      isSlotOverlap(item.slot, nextSlot) &&
      item.courseId !== newEntry.courseId
    );

    if (hasOverlap) {
      alert('That time overlaps with an existing class on the same day.');
      return;
    }

    updateCourseShortName(courseId, displayName);

    const updated = quickFormEditingId
      ? normalizeScheduleEntries(schedule.map(item => item.id === quickFormEditingId ? newEntry : item))
      : normalizeScheduleEntries([...schedule, newEntry]);

    setSchedule(updated);
    store.set('schedule', updated);
    closeQuickForm();
  };

  const remove = (id) => {
    const updated = normalizeScheduleEntries(schedule.filter(s => s.id !== id));
    setSchedule(updated);
    store.set('schedule', updated);
  };

  const tableSlots = useMemo(() => {
    const slots = getSlotCatalog(schedule, slotList).filter(slot => !isLongSessionalSlot(slot));
    return slots.length ? slots : getSlotCatalog(schedule, slotList);
  }, [schedule, slotList]);

  const tableLayout = useMemo(() => {
    const starts = {};
    const covered = {};

    DAYS.forEach(day => {
      starts[day] = {};
      covered[day] = new Set();
    });

    schedule.forEach(item => {
      if (!starts[item.day]) return;

      const overlappingSlots = tableSlots.filter(slot => !String(slot).toLowerCase().includes('break') && isSlotOverlap(slot, item.slot));
      const firstSlot = overlappingSlots[0] || tableSlots.find(slot => String(slot).trim() === String(item.slot).trim());
      if (!firstSlot) return;

      if (!starts[item.day][firstSlot]) starts[item.day][firstSlot] = [];
      const rowSpan = Math.max(1, overlappingSlots.length || 1);
      starts[item.day][firstSlot].push({ item, rowSpan });

      overlappingSlots.slice(1).forEach(slot => covered[item.day].add(slot));
    });

    return { starts, covered };
  }, [schedule, tableSlots]);

  const selectedClasses = useMemo(() => schedule.filter(item => item.day === selectedDay), [schedule, selectedDay]);
  const selectedScheduleText = useMemo(
    () => buildDailyText(selectedDay, selectedClasses, getCourse, 'whatsapp'),
    [selectedDay, selectedClasses]
  );

  const slotPreview = (slot) => {
    const cleanSlot = String(slot).replace(/\s+break\s*$/i, '').trim();
    const match = cleanSlot.match(/^(.+)-(.+)$/);
    if (!match) return cleanSlot;
    return `${match[1]} → ${match[2]}`;
  };

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
                      fontWeight: d === selectedDay ? 700 : 500,
                      color: d === selectedDay ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {formatDayShort(d)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableSlots.map(p => {
              const breakSlot = String(p).toLowerCase().includes('break');
              return (
                <tr key={p}>
                  <td style={{ padding: '12px 12px', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)' }}>{slotPreview(p)}</td>
                  {DAYS.map(d => {
                    if (tableLayout.covered[d]?.has(p)) return null;
                    const entries = tableLayout.starts[d]?.[p] || [];
                    const dayItems = entries.map(entry => entry.item);
                    const rowSpan = entries.length === 1 ? entries[0].rowSpan : 1;
                    const isEmptyCell = dayItems.length === 0;
                    return (
                      <td
                        key={d}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`}
                        onClick={isEmptyCell ? () => handleEmptyCellClick(d, p) : undefined}
                        title={isEmptyCell ? 'Double-click to add class' : undefined}
                        style={{
                          padding: '6px',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          verticalAlign: 'top',
                          minHeight: 54,
                          background: breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                          cursor: isEmptyCell ? 'pointer' : 'default',
                        }}
                      >
                        {dayItems.map(s => {
                          const c = getCourse(s.courseId);
                          const isSessional = isSessionalType(s.type);
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleCellClick(s.id, s)}
                              title="Double-click to edit"
                              style={{
                                padding: '8px 9px',
                                borderRadius: 11,
                                fontSize: 12,
                                lineHeight: 1.35,
                                marginBottom: 4,
                                background: isSessional
                                  ? 'linear-gradient(180deg, rgba(34,197,94,0.12), rgba(34,197,94,0.08))'
                                  : 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.08))',
                                border: isSessional
                                  ? '1px solid rgba(34,197,94,0.25)'
                                  : '1px solid rgba(59,130,246,0.18)',
                                color: 'var(--text)',
                                position: 'relative',
                                cursor: 'pointer',
                                userSelect: 'none',
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.35, letterSpacing: '0.01em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
                                {s.displayName || c?.code || c?.name || '?'}
                              </div>
                              {!isSessional && (
                                <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: 'var(--text)', opacity: 0.95, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  Teacher: {s.teacherName || 'Not set'}
                                </div>
                              )}
                              <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} style={{
                                position: 'absolute', top: 2, right: 16, background: 'none', border: 'none',
                                color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                                touchAction: 'manipulation',
                              }}>
                                ✎
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} style={{
                                position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                                color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                                touchAction: 'manipulation',
                              }}>
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const handleCopySchedule = async () => {
    try {
      await navigator.clipboard.writeText(selectedScheduleText);
      setCopied(true);
      setMessage(`Copied WhatsApp schedule for ${selectedDay}.`);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      alert('Copy failed: ' + (e && e.message ? e.message : String(e)));
    }
  };

  const handleExportRoutine = () => {
    const payload = buildRoutineBackupPayload(schedule, settings, assignments, teachers);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kuetx-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Routine backup exported successfully.');
  };

  return (
    <div className="page-enter page-container" style={{ maxWidth: 1120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>Class Management</h2>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Profile: {profile.name || '—'} {profile.isCR ? '· Class Rep' : ''}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 999 }}>
          Under construction
        </div>
      </div>

      {message && (
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: 'var(--text)', fontSize: 13 }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ padding: 18, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 12 }}>Quick Routine Tools</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleCopySchedule}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(37,211,102,0.35)', background: 'linear-gradient(180deg, rgba(37,211,102,0.16), rgba(37,211,102,0.10))', color: 'var(--text)', fontWeight: 800 }}
            >
              {copied ? 'Copied ✓' : 'Copy WhatsApp'}
            </button>
            <button
              onClick={handleExportRoutine}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700 }}
            >
              Export Routine
            </button>
          </div>
        </div>

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
                <span className="fs-icon" aria-hidden style={{ display: 'inline-block', lineHeight: 0 }}>⤢</span>
                <span className="fs-label" style={{ marginLeft: 8, fontWeight: 700 }}>Full</span>
              </button>
            </div>
          </div>

          {renderTimetable()}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: 18, borderRadius: 18, border: '1px solid rgba(59,130,246,0.20)', background: 'linear-gradient(180deg, rgba(59,130,246,0.08), rgba(59,130,246,0.03))', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(59,130,246,0.22)', background: 'rgba(59,130,246,0.10)', color: 'var(--text)', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
              Under Construction
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.02em' }}>
              This is the temporary CR workspace
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.75, maxWidth: 720, margin: '0 auto' }}>
              The routine sharing tools above are ready now. The full class management suite will grow here step by step, so the workspace stays focused and easy to use.
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 800 }}>
              ETA: Under construction
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Class roster & attendance management</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Monitor class presence and keep CR-level attendance records in one place.</div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Programme management</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Handle course allocations, sections, and class-level planning.</div>
            </div>
            <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Planned</div>
              <div style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8 }}>Meeting management & minutes</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6 }}>Keep meeting notes, action items, and follow-ups organized for the class.</div>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.75 }}>
              Need a feature? <Link to="/about#developer" style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>Jump to Developer Info</Link> and contact the developer directly from there, then mention "Class Management" in your message.
            </div>
          </div>
        </div>
      </div>

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
          zIndex: 3000,
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
            zIndex: 3010,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
              {quickFormEditingId ? 'Quick Edit' : 'Quick Add'} · {quickFormData.day} · {slotPreview(quickFormData.slot)}
            </div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Course</label>
                <select
                  value={quickFormData.courseId}
                  onChange={e => handleQuickCourseChange(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="">Select course</option>
                  {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Show As (Grid Name)</label>
                <input
                  type="text"
                  value={quickFormData.displayName}
                  onChange={e => {
                    const nextName = e.target.value;
                    setQuickFormData(d => ({ ...d, displayName: nextName }));
                    if (quickFormData.courseId) updateCourseShortName(quickFormData.courseId, nextName);
                  }}
                  placeholder={autoDisplayName(quickFormData.courseId, quickFormData.teacherName || '') || 'CSE 2201 DS'}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Type</label>
                <select
                  value={quickFormData.type}
                  onChange={e => handleQuickTypeChange(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  <option value="Theory">Theory</option>
                  <option value="Sessional">Lab / Sessional</option>
                  <option value="Project">Project</option>
                  <option value="Tutorial">Tutorial / Section</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Time</label>
                <select
                  value={quickFormData.slot}
                  onChange={e => setQuickFormData(d => ({ ...d, slot: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                >
                  {getAllowedSlotsForType(quickFormData.type).map(p => <option key={p} value={p}>{slotPreview(p)}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Teacher (Select One)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <select
                    value={quickFormData.teacherName}
                    onChange={e => setQuickFormData(d => ({ ...d, teacherName: e.target.value }))}
                    disabled={!quickFormData.courseId || getCourseTeachers(quickFormData.courseId).length === 0}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                  >
                    <option value="">Select teacher</option>
                    {getCourseTeachers(quickFormData.courseId).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (!quickFormData.courseId) return;
                      setCourseTeacherDialogState({ open: true, courseId: quickFormData.courseId, source: 'quick' });
                    }}
                    disabled={!quickFormData.courseId}
                  >
                    {getCourseTeachers(quickFormData.courseId).length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
                  </button>
                </div>
                {quickFormData.courseId && getCourseTeachers(quickFormData.courseId).length < 2 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'rgb(180,83,9)' }}>
                    This course needs two fixed teachers before adding class.
                  </div>
                )}
              </div>

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
                disabled={!!quickFormData.courseId && getCourseTeachers(quickFormData.courseId).length < 2}
                style={{ padding: '8px 14px' }}
              >
                {quickFormEditingId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CourseTeacherDialog
        isOpen={courseTeacherDialogState.open}
        onClose={handleCourseTeacherDialogClose}
        course={getCourse(courseTeacherDialogState.courseId)}
        currentTeachers={getCourseTeachers(courseTeacherDialogState.courseId)}
        onSave={handleCourseTeacherDialogSave}
        allTeachers={allKnownTeachers}
        requireTwoTeachers
      />

      {fullScreenOpen && (
        <div className="fullscreen-overlay" style={{ zIndex: 1100 }} onClick={() => setFullScreenOpen(false)}>
          <div className="fullscreen-content fullscreen-rotated" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Timetable Full View</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Same routine grid, full screen.</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.95 }}>Double-click any entry to edit.</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setFullScreenOpen(false)}>Close</button>
            </div>
            {renderTimetable({ large: true, fullView: true })}
          </div>
        </div>
      )}
    </div>
  );
}
