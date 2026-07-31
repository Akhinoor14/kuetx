import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal';
import { Plus, Settings2, Clock3, PencilLine, Copy, CalendarDays, X, FileText, BookOpen, Pencil, ClipboardList, Lightbulb, Sprout, GraduationCap, Rocket } from 'lucide-react';
import { store, uid, getProfile, getCurrentTermKey, getRoutinePreviewDate, isRoutineHoliday, getTermTimeline } from '../store/store';
import { getAllCourses } from '../store/curriculumStore';
import { useNavigate, Link } from 'react-router-dom';
import CourseTeacherDialog from '../components/CourseTeacherDialog';
import { notify } from '../lib/notify';
import { confirmDialog } from '../lib/dialog';
import { getGroupId } from '../lib/groupUtils';
import { subscribeCRStatus, subscribeRoutine, addRoutineEntry, updateRoutineEntry, deleteRoutineEntry, subscribeClassSetup } from '../lib/groupSync';
import { subscribeGroupTermStartDate } from '../lib/termStartDateSync';
import { useCanEditGroup } from '../hooks/useCanEditGroup';
import TeacherClaimBanner from '../components/TeacherClaimBanner';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
// Compact 3-letter label for day-selector chips (Sun/Mon/Tue/Wed/Thu) —
// same treatment applied to the faculty schedule page's day chips, kept
// consistent here so both surfaces look/feel the same.
const formatDayShort = (day) => day.slice(0, 3);
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
  { id: 'plain', label: 'Copy Text', sample: 'Schedule for Sunday' },
  { id: 'whatsapp', label: 'Copy WhatsApp', sample: '📅 *Schedule for Sunday*' },
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

// Get all unique teacher names from schedule, sorted
const getUniqueTeacherNames = (schedule) => {
  const teachers = new Set();
  (schedule || []).forEach(item => {
    if (item.teacherName && item.teacherName.trim()) {
      teachers.add(item.teacherName);
    }
  });
  return Array.from(teachers).sort();
};

const normalizeSlotKey = (value) => {
  // Normalize separators (→, ->, –, —, -) and whitespace so variants like
  // "9:40 AM → 10:30 AM" and "9:40 AM - 10:30 AM" compare equal
  return String(value || '')
    .trim()
    .replace(/\s*(→|->|–|—)\s*/g, ' - ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
};

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
  const match = String(slot || '').match(/^(.+?)\s*(?:→|->|–|—|-)\s*(.+)$/);
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
  // baseSlots always take priority; schedule slots fill in extras
  [...(baseSlots || []), ...((schedule || []).map(item => item.slot))].forEach(slot => {
    const range = parseSlotRange(slot);
    // Use time-based key so '9:40 AM → 10:30 AM' and '9:40 AM - 10:30 AM' map to same slot
    const key = range ? `${range.start}-${range.end}` : normalizeSlotKey(slot);
    if (key && !unique.has(key)) unique.set(key, slot); // keep first (baseSlot) spelling
  });
  return [...unique.values()].sort((a, b) => slotSortValue(a) - slotSortValue(b) || a.localeCompare(b));
};

const isSlotOverlap = (a, b) => {
  const rangeA = parseSlotRange(a);
  const rangeB = parseSlotRange(b);
  if (!rangeA || !rangeB) return normalizeSlotKey(a) === normalizeSlotKey(b);
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
};

const isSessionalType = (type) => /sessional|lab/i.test(String(type || ''));

// Detect course type based on course code: even code = Sessional, odd code = Theory
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

const buildDailyText = (day, classes, getCourse, assignments = [], messageFormat = 'plain') => {
  const lines = [];
  const getClassShareLabel = (item) => {
    const course = getCourse(item.courseId);
    return item.displayName || course?.name || course?.code || 'Unknown Course';
  };
  
  if (messageFormat === 'whatsapp') {
    // WhatsApp format: Time + Teacher only
    lines.push(`*_📅 Schedule for ${day}_*`);
    lines.push('');
    
    if (classes.length) {
      const sortedClasses = classes.slice().sort((a, b) => a.slot.localeCompare(b.slot));
      
      sortedClasses.forEach((item, idx) => {
        const cleanSlot = String(item.slot).replace(/\s+break\s*$/i, '').trim();
        const classLabel = isSessionalType(item.type) ? getClassShareLabel(item) : (item.teacherName || 'Teacher not set');
        
        // Theory: Time — Teacher, Sessional: Time — Course/Lab name
        lines.push(`${idx + 1}. *${cleanSlot}* — _${classLabel}_`);
      });
    }
    
    // Add assignments due in next 2 days
    if (assignments.length > 0) {
      lines.push('');
      lines.push('────────────────');
      lines.push('*_📌 Assignment Reminder_*');
      lines.push('');
      
      // Group assignments by teacher
      const byTeacher = {};
      assignments.forEach(a => {
        const course = getCourse(a.courseId);
        const teacher = course?.teacher || 'Unknown Teacher';
        if (!byTeacher[teacher]) byTeacher[teacher] = [];
        byTeacher[teacher].push(a);
      });
      
      // Format each teacher's assignments
      Object.entries(byTeacher).forEach(([teacher, teacherAssignments]) => {
        teacherAssignments.forEach((a, idx) => {
          const dueDate = new Date(`${a.due}T00:00:00`);
          const dateStr = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          
          lines.push(`> Assignment for *${teacher}*`);
          lines.push(`${a.topic || 'Assignment'}`);
          lines.push(`_Deadline: ${dateStr}_ ⏰`);
          
          if (idx < teacherAssignments.length - 1) {
            lines.push('');
          }
        });
      });
    }
  } else {
    // Plain format
    lines.push(`Schedule for ${day}`);
    
    if (classes.length) {
      classes
        .slice()
        .sort((a, b) => a.slot.localeCompare(b.slot))
        .forEach(item => {
          const course = getCourse(item.courseId);
          const courseLabel = item.displayName || course?.name || course?.code || 'Unknown Course';
          const teacherLabel = item.teacherName || 'Teacher not set';
          const visibleLabel = isSessionalType(item.type) ? courseLabel : teacherLabel;
          lines.push(`${item.slot} · ${visibleLabel}`);
        });
    }
    
    // Plain format assignment reminders
    if (assignments.length > 0) {
      lines.push('');
      lines.push('────────────────');
      lines.push('Assignment Reminder');
      lines.push('');
      
      const byTeacher = {};
      assignments.forEach(a => {
        const course = getCourse(a.courseId);
        const teacher = course?.teacher || 'Unknown Teacher';
        if (!byTeacher[teacher]) byTeacher[teacher] = [];
        byTeacher[teacher].push(a);
      });
      
      Object.entries(byTeacher).forEach(([teacher, teacherAssignments]) => {
        teacherAssignments.forEach((a, idx) => {
          const dueDate = new Date(`${a.due}T00:00:00`);
          const dateStr = dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          
          lines.push(`Assignment for ${teacher}`);
          lines.push(`${a.topic || 'Assignment'}`);
          lines.push(`Deadline: ${dateStr}`);
          
          if (idx < teacherAssignments.length - 1) {
            lines.push('');
          }
        });
      });
    }
  }
  
  return lines.join('\n');
};

const getRoutineLabel = (course, item) => {
  if (item.displayName) return item.displayName;
  const courseLabel = course?.name || course?.code || 'Unknown Course';
  const teacherLabel = item.teacherName || 'Teacher not set';
  return `${courseLabel} · ${teacherLabel}`;
};

export default function Schedule() {
  const navigate = useNavigate();
  const profile = getProfile();

  // Class-group mode: if this student's batch+dept group currently has an
  // active CR, the shared routine takes over the view (read-only unless
  // this user is CR/ACR/Campus Lead/Admin, or the group temporarily has no
  // CR). Personal schedule below is completely untouched either way — it's
  // never read from or written to in group mode, just not rendered.
  const groupId = useMemo(() => getGroupId(profile), [profile.dept, profile.batch]);
  const [groupHasCR, setGroupHasCR] = useState(null); // null = unknown yet
  useEffect(() => {
    if (!groupId) { setGroupHasCR(false); return; }
    return subscribeCRStatus(groupId, (status) => setGroupHasCR(!!status?.hasCR));
  }, [groupId]);
  const { canEdit: canEditGroupSchedule } = useCanEditGroup(groupId);
  // Single source of truth for "are we in shared/group mode": avoids a
  // flicker where groupId exists but groupHasCR hasn't resolved yet (null),
  // which would otherwise let personal-mode render for a beat before
  // flipping to group mode. isGroupMode is only true once we KNOW the
  // group currently has an active CR; unknown/false both mean personal mode.
  const groupModeLoading = !!groupId && groupHasCR === null;
  const isGroupMode = !!groupId && groupHasCR === true;
  // canEditSchedule: in group mode this is CR/ACR/CL/admin only (or a
  // verified member while the group temporarily has no CR — see
  // useCanEditGroup). In personal mode the user always owns their own data.
  // Declared here (not just before the render return) so it's safely in
  // scope for renderTimetable's closure regardless of where it's called.
  const canEditSchedule = isGroupMode ? canEditGroupSchedule : true;

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
  
  // Load assignments
  const assignments = useMemo(() => store.get('assignments') || [], []);
  // schedule is either localStorage-backed (solo/personal, unchanged) or
  // Firestore-backed (group mode). isGroupMode decides the source; writes
  // in group mode go through groupSync's addRoutineEntry/updateRoutineEntry/
  // deleteRoutineEntry and setSchedule is ONLY ever called here by the
  // Firestore listener below — never manually alongside a Firestore write,
  // so there's no double-write/loop risk.
  const [schedule, setSchedule] = useState(() => (isGroupMode ? [] : normalizeScheduleEntries(store.get('schedule') || [])));
  useEffect(() => {
    if (!isGroupMode) {
      // Falling back to / staying in personal mode: load from localStorage.
      setSchedule(normalizeScheduleEntries(store.get('schedule') || []));
      return;
    }
    // Group mode: subscribe to the shared Firestore routine and map each
    // entry to the Grid's expected shape. displayName/courseCode/courseName
    // are saved at write-time (see add/remove/quick-save below) so the
    // Grid still shows a real label even if a viewer's local `courses`
    // list doesn't contain the entry's courseId (e.g. CR used a custom
    // course only they have locally).
    return subscribeRoutine(groupId, (entries) => {
      const mapped = (entries || []).map((e) => ({
        id: e.id,
        day: e.day || 'Sunday',
        slot: e.slot || '',
        courseId: e.courseId || '',
        teacherName: e.teacherName || '',
        displayName: e.displayName || e.courseCode || e.courseName || '',
        room: e.room || '',
        note: e.note || '',
        type: e.type || 'Theory',
      }));
      setSchedule(normalizeScheduleEntries(mapped));
    });
  }, [isGroupMode, groupId]);
  const [settings, setSettings] = useState(() => normalizeSettings(store.get('scheduleSettings')));
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [selectedDay, setSelectedDay] = useState(() => dateToDayName(getRoutinePreviewDate((store.get('scheduleSettings')?.holidayDates) || [])));
  const [holidaySetupOpen, setHolidaySetupOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayMode, setHolidayMode] = useState('calendar'); // 'single' or 'calendar'
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [calendarSelectedDates, setCalendarSelectedDates] = useState(new Set());
  const [nowTick, setNowTick] = useState(() => Date.now());
  const autoPreviewDayRef = useRef(dateToDayName(getRoutinePreviewDate((store.get('scheduleSettings')?.holidayDates) || [])));
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
  const [quickFormData, setQuickFormData] = useState({ day: '', slot: '', courseId: '', teacherName: '', displayName: '', room: '', note: '', type: 'Theory' });
  const [quickFormEditingId, setQuickFormEditingId] = useState(null);
  const [courseTeacherDialogState, setCourseTeacherDialogState] = useState({ open: false, courseId: '', source: null });
  const [allKnownTeachers, setAllKnownTeachers] = useState(() => getUniqueTeacherNames(schedule));
  
  // Track double-click/double-tap
  const lastClickRef = useRef({});

  const openHolidaySetup = () => {
    setHolidaySetupOpen(true);
  };

  const closeHolidaySetup = () => {
    setHolidaySetupOpen(false);
    setHolidayDate('');
    setHolidayMode('calendar');
    setCalendarSelectedDates(new Set());
  };
  
  const openQuickAdd = (day, slot, courseId = '') => {
    setQuickFormEditingId(null);
    // Auto-detect type based on slot length
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

  const handleFormCourseChange = (courseId) => {
    const teachers = getCourseTeachers(courseId);
    const course = getCourse(courseId);
    const detectedType = detectCourseType(course);
    const allowed = getAllowedSlotsForType(detectedType);
    setForm(prev => ({
      ...prev,
      courseId,
      teacherName: teachers[0] || '',
      displayName: courseShortNameMap[courseId] || prev.displayName || '',
      type: detectedType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
    }));
  };

  const handleQuickCourseChange = (courseId) => {
    const teachers = getCourseTeachers(courseId);
    const course = getCourse(courseId);
    const detectedType = detectCourseType(course);
    const allowed = getAllowedSlotsForType(detectedType);
    setQuickFormData(prev => ({
      ...prev,
      courseId,
      teacherName: teachers[0] || '',
      displayName: courseShortNameMap[courseId] || prev.displayName || '',
      type: detectedType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
    }));
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

  const handleFormTypeChange = (nextType) => {
    const allowed = getAllowedSlotsForType(nextType);
    setForm(prev => ({
      ...prev,
      type: nextType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
    }));
  };

  const handleQuickTypeChange = (nextType) => {
    const allowed = getAllowedSlotsForType(nextType);
    setQuickFormData(prev => ({
      ...prev,
      type: nextType,
      slot: allowed.includes(prev.slot) ? prev.slot : (allowed[0] || prev.slot),
      _extraSlot: null, // clear injected slot on type change
    }));
  };

  const persistSettings = (next) => {
    const normalized = normalizeSettings(next);
    setSettings(normalized);
    store.set('scheduleSettings', normalized);
  };

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
    persistSettings({ ...settings, courseShortNameMap: nextMap });
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
    const courseTeachers = getCourseTeachers(item.courseId);
    const itemType = item.type || 'Theory';
    const itemSlot = item.slot || '';
    // Ensure the item's slot is included in allowed slots for its type
    const allowedForType = getAllowedSlotsForType(itemType);
    const slotInList = allowedForType.includes(itemSlot);
    setQuickFormEditingId(item.id);
    setQuickFormData({
      day: item.day || 'Sunday',
      slot: itemSlot,
      courseId: item.courseId || '',
      teacherName: item.teacherName || courseTeachers[0] || '',
      displayName: item.displayName || courseShortNameMap[item.courseId] || '',
      room: item.room || '',
      note: item.note || '',
      type: itemType,
      _extraSlot: slotInList ? null : itemSlot, // inject into select if missing
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
    setQuickFormData({ day: '', slot: '', courseId: '', teacherName: '', displayName: '', room: '', note: '', type: 'Theory', _extraSlot: null });
  };

  const handleCourseTeacherDialogClose = () => {
    setCourseTeacherDialogState({ open: false, courseId: '', source: null });
  };

  const handleCourseTeacherDialogSave = (teachers) => {
    const courseId = courseTeacherDialogState.courseId;
    const normalizedTeachers = [...new Set((teachers || []).map(name => normalizeTeacherName(name)).filter(Boolean))].slice(0, 2);
    if (!courseId || normalizedTeachers.length < 2) return;

    // Update course-teacher mapping
    const nextMap = {
      ...(courseTeacherMap || {}),
      [courseId]: normalizedTeachers,
    };
    persistSettings({ ...settings, courseTeacherMap: nextMap });

    // Sync: Auto-add teachers to Teachers database if they don't exist
    const existingTeachers = store.get('teachers') || [];
    const existingNames = new Set(existingTeachers.map(t => t.name));
    
    const newTeachers = normalizedTeachers
      .filter(name => !existingNames.has(name))
      .map(name => ({
        id: uid(),
        name,
        initial: name.split(/\s+/).map(part => part[0].toUpperCase()).join(''),
        title: '',
        dept: profile?.dept || '',
        phone: '',
        email: '',
        courses: '',
        officeRoom: '',
        rating: '',
        notes: 'Auto-added from schedule',
      }));

    if (newTeachers.length > 0) {
      const updatedTeachers = [...existingTeachers, ...newTeachers];
      store.set('teachers', updatedTeachers);
    }

    // Update form states
    if (courseTeacherDialogState.source === 'form') {
      setForm(prev => ({
        ...prev,
        courseId,
        teacherName: prev.teacherName && normalizedTeachers.includes(prev.teacherName) ? prev.teacherName : normalizedTeachers[0],
      }));
    }

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
      notify('Please select a course and time', 'error');
      return;
    }

    const allowedSlots = getAllowedSlotsForType(type);
    const isExtraSlot = quickFormData._extraSlot && slot === quickFormData._extraSlot;
    if (!allowedSlots.includes(slot) && !isExtraSlot) {
      notify(isSessionalType(type)
        ? 'Sessional class must use a long lab slot (for example 2:30 PM-5:00 PM).'
        : 'Theory/project/tutorial should use regular class slots.', 'error');
      return;
    }

    const availableTeachers = getCourseTeachers(courseId);
    // In group mode, a CR/ACR may be editing an entry whose courseId isn't
    // in THEIR local teacher-map (e.g. another member's custom course).
    // Don't block on the "2 teachers configured" gate there — fall back to
    // whatever teacher name is already on the form/entry instead.
    if (!isGroupMode && availableTeachers.length < 2) {
      notify('Please set both teachers for this course first.', 'error');
      ensureCourseTeacherSetup(courseId, 'quick');
      return;
    }

    const selectedTeacher = normalizeTeacherName(teacherName) || availableTeachers[0] || '';
    if (!selectedTeacher) {
      notify('Please select a teacher for this class', 'error');
      return;
    }

    const nextSlot = normalizeSlotKey(slot);
    const courseObj = courses.find(c => c.id === courseId);

    const newEntry = {
      day,
      slot: nextSlot,
      courseId,
      displayName: String(displayName || '').trim() || courseShortNameMap[courseId] || autoDisplayName(courseId, selectedTeacher),
      courseCode: courseObj?.code || '',
      courseName: courseObj?.name || '',
      room,
      teacherNames: availableTeachers.length ? availableTeachers : [selectedTeacher],
      teacherName: selectedTeacher,
      type,
      note,
      id: quickFormEditingId || uid()
    };

    const existingSchedule = schedule.filter(item => item.id !== quickFormEditingId);

    const hasOverlap = existingSchedule.some(item => 
      item.day === newEntry.day && 
      isSlotOverlap(item.slot, nextSlot) &&
      item.courseId !== newEntry.courseId
    );

    if (hasOverlap) {
      notify('That time overlaps with an existing class on the same day.', 'error');
      return;
    }

    updateCourseShortName(courseId, displayName);

    if (isGroupMode) {
    if (!canEditGroupSchedule) { notify('You do not have permission to edit this routine.', 'error'); return; }
      const { id, teacherNames, ...entryData } = newEntry;
      if (quickFormEditingId) {
        updateRoutineEntry(groupId, quickFormEditingId, profile, entryData);
      } else {
        addRoutineEntry(groupId, profile, entryData);
      }
      // Do NOT call setSchedule here — the Firestore onSnapshot listener
      // (see the effect near the schedule useState) is the only writer to
      // schedule state in group mode. This avoids double-write races.
      closeQuickForm();
      return;
    }

    const updated = quickFormEditingId
      ? normalizeScheduleEntries(schedule.map(item => item.id === quickFormEditingId ? newEntry : item))
      : normalizeScheduleEntries([...schedule, newEntry]);

    setSchedule(updated);
    store.set('schedule', updated);
    closeQuickForm();
  };

  const add = () => {
    if (!form.courseId || !form.slot) return;

    const allowedSlots = getAllowedSlotsForType(form.type);
    if (!allowedSlots.includes(form.slot)) {
      notify(isSessionalType(form.type)
        ? 'Sessional class must use a long lab slot (for example 2:30 PM-5:00 PM).'
        : 'Theory/project/tutorial should use regular class slots.', 'error');
      return;
    }

    const availableTeachers = getCourseTeachers(form.courseId);
    if (!isGroupMode && availableTeachers.length < 2) {
      ensureCourseTeacherSetup(form.courseId, 'form');
      return;
    }

    const selectedTeacher = normalizeTeacherName(form.teacherName) || availableTeachers[0] || '';
    if (!selectedTeacher) {
      notify('Please select a teacher for this class', 'error');
      return;
    }

    const nextSlot = normalizeSlotKey(form.slot);
    const courseObj = courses.find(c => c.id === form.courseId);

    const nextEntry = {
      ...form,
      teacherName: selectedTeacher,
      teacherNames: availableTeachers.length ? availableTeachers : [selectedTeacher],
      displayName: String(form.displayName || '').trim() || courseShortNameMap[form.courseId] || autoDisplayName(form.courseId, selectedTeacher),
      courseCode: courseObj?.code || '',
      courseName: courseObj?.name || '',
      slot: nextSlot,
      id: uid()
    };

    const existingSchedule = schedule.filter(item => item.id !== editingId);

    const hasUserTimeConflict = existingSchedule.some(item => 
      item.id !== editingId && 
      item.day === nextEntry.day && 
      isSlotOverlap(item.slot, nextSlot) &&
      item.courseId !== nextEntry.courseId
    );
    if (hasUserTimeConflict) {
      notify('That time overlaps with an existing class on the same day.', 'error');
      return;
    }

    updateCourseShortName(form.courseId, form.displayName);

    if (isGroupMode) {
    if (!canEditGroupSchedule) { notify('You do not have permission to edit this routine.', 'error'); return; }
      const { id, teacherNames, ...entryData } = nextEntry;
      if (editingId) {
        updateRoutineEntry(groupId, editingId, profile, entryData);
      } else {
        addRoutineEntry(groupId, profile, entryData);
      }
      // No manual setSchedule here — see note above on the Firestore listener.
      cancelEdit();
      return;
    }

    const updated = editingId
      ? normalizeScheduleEntries(schedule.map(item => item.id === editingId ? { ...nextEntry, id: editingId } : item))
      : normalizeScheduleEntries([...schedule, nextEntry]);
    
    setSchedule(updated);
    store.set('schedule', updated);
    cancelEdit();
  };

  const remove = (id) => {
    if (isGroupMode) {
    if (!canEditGroupSchedule) { notify('You do not have permission to edit this routine.', 'error'); return; }
      deleteRoutineEntry(groupId, id, profile);
      if (editingId === id) cancelEdit();
      return;
    }
    const updated = normalizeScheduleEntries(schedule.filter(s => s.id !== id));
    setSchedule(updated);
    store.set('schedule', updated);
    if (editingId === id) cancelEdit();
  };

  const buildRoutineBackupPayload = () => ({
    version: 1,
    type: 'kuetx-routine-backup',
    exportedAt: new Date().toISOString(),
    data: {
      schedule: normalizeScheduleEntries(schedule),
      scheduleSettings: settings,
      examOverrides: examOverrides || {},
      assignments: store.get('assignments') || [],
      teachers: store.get('teachers') || [],
    },
  });

  const exportRoutine = () => {
    const payload = buildRoutineBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const _td = new Date();
    link.download = `kuetx-routine-backup-${_td.getFullYear()}-${String(_td.getMonth()+1).padStart(2,'0')}-${String(_td.getDate()).padStart(2,'0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage('Routine backup exported successfully.');
  };

  const importRoutine = async (file) => {
    if (!file) return;
    if (isGroupMode) {
      // Bulk-importing a personal backup file straight into shared Firestore
      // schedule isn't supported yet — doing it via setSchedule() would only
      // show the imported data locally for a moment before the next
      // Firestore snapshot silently overwrote it with the real shared data,
      // which is confusing. Block it clearly instead of half-working.
      setImportMessage('Import is not supported for group/shared schedules yet. Import only works for personal (non-group) routines.');
      return;
    }
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const source = (payload && payload.data && typeof payload.data === 'object') ? payload.data : payload;
      const nextSchedule = normalizeScheduleEntries(Array.isArray(source.schedule) ? source.schedule : []);
      const nextSettings = normalizeSettings(source.scheduleSettings || {});
      const nextExamOverrides = source.examOverrides && typeof source.examOverrides === 'object' ? source.examOverrides : {};
      const nextAssignments = Array.isArray(source.assignments) ? source.assignments : [];
      const nextTeachers = Array.isArray(source.teachers) ? source.teachers : [];

      setSchedule(nextSchedule);
      setSettings(nextSettings);
      setExamOverrides(nextExamOverrides);
      store.set('schedule', nextSchedule);
      store.set('scheduleSettings', nextSettings);
      store.set('examOverrides', nextExamOverrides);
      store.set('assignments', nextAssignments);
      store.set('teachers', nextTeachers);
      setImportMessage(`Imported routine data with ${nextSchedule.length} class${nextSchedule.length === 1 ? '' : 'es'} and related assignment/teacher data.`);
    } catch {
      setImportMessage('Import failed. Please use a valid routine backup JSON file.');
    }
  };

  const getCourse = (id) => courses.find(c => c.id === id);

  // Get upcoming assignments for selected day (within 3 days before deadline)
  const getUpcomingAssignmentsForDay = (day) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For each assignment, check if it falls within 3 days before its deadline on this day
    return assignments
      .filter(a => a.status !== 'done' && a.due)
      .map(a => {
        const dueDate = new Date(`${a.due}T00:00:00`);
        const dayOfWeek = dueDate.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Check if this assignment is for the selected day
        if (dayOfWeek === day) {
          const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          return { ...a, daysLeft, isToday: daysLeft === 0 };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  };

  // Get assignments due within next 2 days for copy format
  const getAssignmentsNextTwoDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    
    return assignments
      .filter(a => a.status !== 'done' && a.due)
      .filter(a => {
        const dueDate = new Date(`${a.due}T00:00:00`);
        return dueDate >= today && dueDate <= twoDaysLater;
      })
      .sort((a, b) => new Date(`${a.due}T00:00:00`) - new Date(`${b.due}T00:00:00`));
  };

  // Color scheme for course badges
  const getCourseColor = (courseId, index) => {
    const colors = [
      { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', text: 'var(--accent)' },
      { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.35)', text: 'rgb(34,197,94)' },
      { bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.35)', text: 'rgb(168,85,247)' },
      { bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', text: 'rgb(249,115,22)' },
      { bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.35)', text: 'rgb(236,72,153)' },
    ];
    return colors[index % colors.length];
  };

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
      // Prefer exact match as anchor row; fall back to first overlapping slot
      const exactMatch = overlappingSlots.find(slot => normalizeSlotKey(slot) === normalizeSlotKey(item.slot));
      const firstSlot = exactMatch || overlappingSlots[0] || tableSlots.find(slot => normalizeSlotKey(slot) === normalizeSlotKey(item.slot));
      if (!firstSlot) return;

      if (!starts[item.day][firstSlot]) starts[item.day][firstSlot] = [];
      // rowSpan: count slots from firstSlot onward that overlap
      const slotsFromFirst = exactMatch
        ? overlappingSlots.slice(overlappingSlots.indexOf(exactMatch))
        : overlappingSlots;
      const rowSpan = Math.max(1, slotsFromFirst.length || 1);
      starts[item.day][firstSlot].push({ item, rowSpan });

      slotsFromFirst.slice(1).forEach(slot => covered[item.day].add(slot));
    });

    return { starts, covered };
  }, [schedule, tableSlots]);

  const todayIndex = new Date().getDay();
  const today = DAYS[todayIndex] || 'Sunday';
  const todayClasses = schedule.filter(s => s.day === today);
  const selectedClasses = schedule.filter(s => s.day === selectedDay);
  const currentCalendarDay = today;
  const selectedFormatLabel = MESSAGE_FORMATS.find(format => format.id === settings.messageFormat)?.label || 'Plain';
  const selectedScheduleText = buildDailyText(selectedDay, selectedClasses, getCourse, getAssignmentsNextTwoDays(), settings.messageFormat);

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

  const toggleCalendarDate = (dateStr) => {
    const newSet = new Set(calendarSelectedDates);
    if (newSet.has(dateStr)) {
      newSet.delete(dateStr);
    } else {
      newSet.add(dateStr);
    }
    setCalendarSelectedDates(newSet);
  };

  const addCalendarSelectedDates = () => {
    if (calendarSelectedDates.size === 0) {
      notify('Please select at least one date from the calendar.', 'error');
      return;
    }
    saveHolidayDates([...holidayDates, ...Array.from(calendarSelectedDates)]);
    setCalendarSelectedDates(new Set());
  };

  const renderCalendar = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const weeks = [];
    let week = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      week.push(null);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      week.push({ day, dateStr });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    
    // Add empty cells to complete last week
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }
    
    return weeks;
  };

  const monthName = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const prevMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    let prevM = month - 1;
    let prevY = year;
    if (prevM < 1) {
      prevM = 12;
      prevY = year - 1;
    }
    setCalendarMonth(`${String(prevY).padStart(4, '0')}-${String(prevM).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [year, month] = calendarMonth.split('-').map(Number);
    let nextM = month + 1;
    let nextY = year;
    if (nextM > 12) {
      nextM = 1;
      nextY = year + 1;
    }
    setCalendarMonth(`${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}`);
  };

  const copySelectedSchedule = async () => {
    try {
      await navigator.clipboard.writeText(selectedScheduleText);
    } catch {
      // no-op
    }
  };

  // Exam overrides stored per-term: { [termKey]: [{ course: 1, examDate: 'YYYY-MM-DD', name: '...' }, ...] }
  // In group mode this now lives on the group-wide classSetup doc (CR/ACR-
  // only, like the other roadmap fields below) instead of per-student local
  // storage, so every classmate sees the same exam names/dates. Personal
  // (non-group) mode keeps the old local-only behavior.
  const [examOverrides, setExamOverrides] = useState(() => store.get('examOverrides') || {});
  const effectiveExamOverrides = isGroupMode ? (classSetup?.examOverrides || {}) : examOverrides;
  const [editingExams, setEditingExams] = useState(false);
  const [localExamEdits, setLocalExamEdits] = useState([]);
  // Term timeline (classEndDate/prepLeaveEndDate/examCount/postExamEndDate)
  // used to be a per-student LOCAL setting anyone could edit here — that
  // meant it never synced between classmates and had no single owner.
  // It's now entirely CR/ACR-controlled via the group-wide "Class Setup"
  // page/popup (groups/{groupId}/meta/classSetup) — this page only reads
  // it and displays it; there's no editing UI here anymore. See
  // ClassSetup.jsx / ClassSetupModal.jsx.
  const [classSetup, setClassSetup] = useState(null);
  const [groupTermStartDate, setGroupTermStartDate] = useState(null);
  useEffect(() => {
    if (!groupId) { setClassSetup(null); setGroupTermStartDate(null); return; }
    const unsubSetup = subscribeClassSetup(groupId, setClassSetup);
    const unsubTerm = subscribeGroupTermStartDate(groupId, setGroupTermStartDate);
    return () => { unsubSetup(); unsubTerm(); };
  }, [groupId]);
  const effectiveTermStartDate = groupTermStartDate || profile?.termStartDate || null;
  const roadmapConfig = classSetup || {};

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
  const isFullScreenForm = fullScreenOpen;

  // Hide the fixed bottom-nav while the rotated fullscreen timetable is
  // open — on mobile the nav bar is a sibling fixed element that was
  // showing through/overlapping the rotated schedule view near its edge.
  useEffect(() => {
    if (fullScreenOpen) {
      document.body.classList.add('schedule-fullscreen-active');
    } else {
      document.body.classList.remove('schedule-fullscreen-active');
    }
    return () => document.body.classList.remove('schedule-fullscreen-active');
  }, [fullScreenOpen]);

  const renderTimetable = (opts = {}) => {
    const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: opts.large ? 15 : 13 };
    return (
      <div className={`timetable-grid${opts.fullView ? ' full-view' : ''}`} style={{ overflowX: opts.fullView ? 'hidden' : 'auto', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
        <table style={tableStyle}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th className="time-col" style={{ padding: 'clamp(8px, 2vw, 12px) clamp(6px, 1.5vw, 12px)', borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: opts.fullView ? 0 : 'clamp(85px, 15vw, 110px)', textAlign: 'left', fontSize: 'clamp(11px, 2.5vw, 13px)' }}>Time</th>
              {DAYS.map(d => (
                <th key={d} className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`} style={{ padding: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)', minWidth: opts.fullView ? 0 : 'clamp(120px, 20vw, 160px)' }}>
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
            {tableSlots.map(p => {
              const breakSlot = isBreakSlot(p);
              return (
                <tr key={p}>
                  <td style={{ padding: 'clamp(8px, 2vw, 12px) clamp(6px, 1.5vw, 12px)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', fontWeight: 700, fontSize: 'clamp(11px, 2.5vw, 13px)', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', background: breakSlot ? 'rgba(239,68,68,0.08)' : 'var(--bg)' }}>{slotPreview(p)}</td>
                  {DAYS.map(d => {
                    if (tableLayout.covered[d]?.has(p)) return null;
                    const entries = tableLayout.starts[d]?.[p] || [];
                    const dayItems = entries.map(entry => entry.item);
                    const rowSpan = entries.length === 1 ? entries[0].rowSpan : 1;
                    const isEmptyCell = dayItems.length === 0;
                    const isLabCell = entries.length === 1 && isSessionalType(entries[0]?.item?.type) && rowSpan > 1;
                    return (
                      <td
                        key={d}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        className={`timetable-day-col${d === selectedDay ? ' selected-day' : ''}`}
                        onClick={isEmptyCell && canEditSchedule ? () => handleEmptyCellClick(d, p) : undefined}
                        onDoubleClick={isEmptyCell && canEditSchedule ? () => openQuickAdd(d, p) : undefined}
                        title={isEmptyCell && canEditSchedule ? 'Double-click to add class' : undefined}
                        style={{
                          padding: isLabCell ? 0 : 'clamp(4px, 1.5vw, 6px)',
                          borderBottom: '1px solid var(--border)',
                          borderRight: '1px solid var(--border)',
                          verticalAlign: isLabCell ? 'middle' : 'top',
                          minHeight: 'clamp(56px, 12vw, 72px)',
                          overflow: 'hidden',
                          background: isLabCell
                            ? 'linear-gradient(180deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))'
                            : breakSlot ? 'rgba(239,68,68,0.08)' : d === selectedDay ? 'rgba(59,130,246,0.035)' : 'transparent',
                          cursor: isEmptyCell ? 'pointer' : 'default',
                          touchAction: 'manipulation',
                          textAlign: isLabCell ? 'center' : undefined,
                        }}
                      >
                        {dayItems.map(s => {
                          const c = getCourse(s.courseId);
                          const hideTeacherInGrid = isSessionalType(s.type);
                          const isSessional = hideTeacherInGrid;
                          return (
                            <div
                              key={s.id}
                              onClick={() => canEditSchedule && handleCellClick(s.id, s)}
                              onDoubleClick={() => canEditSchedule && startEdit(s)}
                              title={canEditSchedule ? "Double-click to edit" : undefined}
                              style={isLabCell ? {
                                padding: '8px 24px',
                                fontSize: 13,
                                lineHeight: 1.4,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text)',
                                position: 'relative',
                                cursor: 'pointer',
                                userSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                touchAction: 'manipulation',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                              } : isSessional ? {
                                padding: '6px 24px 6px 6px',
                                fontSize: 12,
                                lineHeight: 1.35,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text)',
                                position: 'relative',
                                cursor: 'pointer',
                                userSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                touchAction: 'manipulation',
                                width: '100%',
                              } : {
                                padding: '8px 9px',
                                borderRadius: 11,
                                fontSize: 12,
                                lineHeight: 1.35,
                                marginBottom: 4,
                                background: 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.08))',
                                border: '1px solid rgba(59,130,246,0.18)',
                                color: 'var(--text)',
                                position: 'relative',
                                cursor: 'pointer',
                                userSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitUserSelect: 'none',
                                touchAction: 'manipulation',
                                // BUGFIX: in fullscreen (6 squeezed columns) this chip had
                                // no overflow containment, so a narrow column let the
                                // absolutely-positioned edit/delete icons visually collide
                                // with the title text instead of the text reserving room
                                // for them. overflow:hidden + boxSizing here, and the
                                // title's own right-padding below, fix that.
                                overflow: 'hidden',
                                boxSizing: 'border-box',
                              }}
                            >
                              <div style={{ fontWeight: 800, fontSize: isSessional ? 'clamp(11px, 2.5vw, 13px)' : 'clamp(10px, 2.5vw, 12px)', lineHeight: 1.35, letterSpacing: '0.01em', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1, paddingRight: (!isLabCell && !isSessional && canEditSchedule) ? 28 : 0 }}>
                                {s.displayName || c?.code || c?.name || '?'}
                              </div>
                              {!hideTeacherInGrid && (
                                <div style={{ fontSize: 'clamp(9px, 2vw, 11px)', fontWeight: 600, marginTop: 'clamp(2px, 0.5vw, 4px)', color: 'var(--text)', opacity: 0.95, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                  Teacher: {s.teacherName || 'Not set'}
                                </div>
                              )}
                              {canEditSchedule && (
                                <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} style={{
                                  position: 'absolute', top: 2, right: 16, background: 'none', border: 'none',
                                  color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                                  touchAction: 'manipulation',
                                }}>
                                  <Pencil size={12} style={{ display: 'block' }} />
                                </button>
                              )}
                              {canEditSchedule && (
                                <button onClick={async (e) => { e.stopPropagation(); if (await confirmDialog('Delete this class?')) remove(s.id); }} style={{
                                  position: 'absolute', top: 2, right: 2, background: 'none', border: 'none',
                                  color: 'inherit', cursor: 'pointer', opacity: 0.55, padding: 0, lineHeight: 1,
                                  touchAction: 'manipulation',
                                }}>
                                  ×
                                </button>
                              )}
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

  // While we don't yet know if this group currently has an active CR,
  // hold off rendering either mode — prevents a flash of personal-mode UI
  // (or the wrong edit permissions) right before flipping to group mode.
  if (groupModeLoading) {
    return (
      <div className="page-enter page-container content-page-bg" style={{ width: "100%", margin: "0 auto", padding: "40px 12px", textAlign: 'center', color: 'var(--muted)' }}>
        Loading schedule…
      </div>
    );
  }

  return (
    <div className="page-enter page-container content-page-bg" style={{ width: "100%", margin: "0 auto", paddingBottom: "20px", paddingLeft: "12px", paddingRight: "12px" }}>
      <div className="content-page-hero">
        <div className="content-page-hero-main">
          <div className="content-page-hero-head">
            <div className="content-page-hero-icon">
              <CalendarDays size={24} color="var(--accent)" />
            </div>
            <h1 className="content-page-hero-title">Class Schedule</h1>
          </div>
          <p className="content-page-hero-subtitle" style={{ maxWidth: 600 }}>
            {isGroupMode
              ? (canEditSchedule
                ? 'Shared with your class group — changes update for everyone.'
                : "Set by your CR/ACR. View only.")
              : 'Your Sun–Thu routine.'}
          </p>
          {isGroupMode && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, paddingLeft: 36 }}>
              <span className="tag tag-green">Shared · Class Group</span>
              {!canEditSchedule && <span className="tag tag-gray">View only</span>}
            </div>
          )}
        </div>
        <div className="content-page-hero-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditingSettings(v => !v)} style={{ fontSize: '12px' }}>
            <Settings2 size={13} /> <span className="btn-txt">Settings</span>
          </button>
          {canEditSchedule && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/courses')} style={{ fontSize: '12px' }} title="Open the Courses page and assign teachers per course">
              <BookOpen size={13} /> <span className="btn-txt btn-txt-long">Manage Course Teachers</span><span className="btn-txt-short">Teachers</span>
            </button>
          )}
          {canEditSchedule && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingId(null); resetForm(); setAdding(true); }} style={{ fontSize: '12px' }} title="Add a new class slot to the schedule">
              <Plus size={13} /> <span className="btn-txt">Add Class</span>
            </button>
          )}
        </div>
      </div>

      {!isGroupMode && (
        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '-8px 0 12px', maxWidth: 600, lineHeight: 1.4 }}>
          Assign teachers via <strong>Manage Course Teachers</strong> before adding classes.
        </p>
      )}

      {/* §8.7 of the merged Faculty Module prompt — read-only, informational
          only. Renders nothing unless a routine entry's free-text
          teacherName matches a verified faculty account for this group;
          declining/dismissing changes nothing about how the schedule
          itself works. Does not touch any of this file's own schedule/
          teacher logic above. */}
      {isGroupMode && <TeacherClaimBanner groupId={groupId} />}

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginBottom: 8 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Holiday Calendar</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>Friday and Saturday are always holidays. Open the popup to add extra dates.</div>
                </div>
                <span
                  onClick={openHolidaySetup}
                  style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                >
                  Manage ↗
                </span>
              </div>
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
                border: settings.messageFormat === 'whatsapp' ? '1px solid rgba(37,211,102,0.35)' : '1px solid rgba(59,130,246,0.24)',
                background: settings.messageFormat === 'whatsapp'
                  ? 'linear-gradient(180deg, rgba(37,211,102,0.16), rgba(37,211,102,0.10))'
                  : 'linear-gradient(180deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))',
                boxShadow: settings.messageFormat === 'whatsapp'
                  ? '0 10px 24px rgba(37,211,102,0.12)'
                  : '0 10px 24px rgba(59,130,246,0.08)',
                color: 'var(--text)',
                fontWeight: 700,
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: settings.messageFormat === 'whatsapp' ? 'rgba(37,211,102,0.18)' : 'rgba(59,130,246,0.14)' }}>
                <Copy size={12} />
              </span>
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.05 }}>
                <span style={{ fontSize: 12 }}>{selectedFormatLabel}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>selected format</span>
              </span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className="btn"
              style={{
                padding: '8px 12px',
                fontSize: '12px',
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
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--card)' }}>
                    <div style={{ fontWeight: '700', fontSize: '11px', color: 'var(--accent)', lineHeight: 1.3, wordBreak: 'break-word' }}>{timeRange}</div>
                    <div style={{ minWidth: '0' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text)', marginBottom: '3px' }}>{courseCode}</div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px', lineHeight: 1.3 }}>{courseName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8, wordBreak: 'break-word' }}>→ {teacherName}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Assignments Preview Section */}
        {(() => {
          const dayAssignments = getUpcomingAssignmentsForDay(selectedDay);
          if (dayAssignments.length === 0) return null;
          return (
            <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg)', marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={14} /> Assignments</div>
                <button
                  onClick={() => navigate('/assignments')}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                >
                  <FileText size={11} /> View all
                </button>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {dayAssignments.map((assignment, index) => {
                  const course = getCourse(assignment.courseId);
                  const courseColor = getCourseColor(assignment.courseId, index);
                  const priorityBg = assignment.priority === 'high' ? 'rgba(239,68,68,0.1)' : assignment.priority === 'medium' ? 'rgba(249,115,22,0.1)' : 'rgba(107,114,128,0.1)';
                  const priorityColor = assignment.priority === 'high' ? 'rgb(239,68,68)' : assignment.priority === 'medium' ? 'rgb(249,115,22)' : 'rgb(107,114,128)';
                  
                  return (
                    <div
                      key={assignment.id}
                      onClick={() => navigate('/assignments')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <div
                          style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: courseColor.bg,
                            border: `1px solid ${courseColor.border}`,
                            color: courseColor.text,
                            fontSize: 11,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {course?.code || 'Unknown'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                            {assignment.title}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11 }}>
                            <span style={{ color: assignment.isToday ? 'rgb(239,68,68)' : 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <CalendarDays size={11} /> {assignment.isToday ? 'Due today' : `${assignment.daysLeft} day${assignment.daysLeft !== 1 ? 's' : ''} left`}
                            </span>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: 3,
                                background: priorityBg,
                                color: priorityColor,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              {assignment.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {adding && (
        <Modal onClose={cancelEdit} contentClassName="add-class-modal-content" contentStyle={{ width: 'min(860px, 98vw)', maxHeight: '92vh', borderColor: 'var(--accent)', padding: 0, background: 'var(--bg)', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 24, boxShadow: '0 30px 80px rgba(0,0,0,0.16)' }}>
          <div style={{ padding: 24, borderBottom: '1px solid var(--border)', background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{editingId ? 'Edit Class Slot' : 'Add Class Slot'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 560 }}>A clean, course-aware class form with the selected teacher and short name visible at a glance.</div>
              </div>
              {editingId && <span className="tag tag-blue">Editing</span>}
            </div>
          </div>
          <div style={{ padding: 24, overflowY: 'auto' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, padding: '12px 14px', background: 'rgba(59,130,246,0.08)', borderRadius: 14, borderLeft: '4px solid var(--accent)' }}>
              <Lightbulb size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} /><strong>Course teacher setup:</strong> Every course needs two fixed teachers. If missing, a popup will ask for both teachers first.
            </div>
            <div className="schedule-add-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 18, alignItems: 'end' }}>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Day</label>
                <select value={form.day} onChange={e => set('day', e.target.value)}>
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Time</label>
                <select value={form.slot} onChange={e => set('slot', e.target.value)}>
                  {getAllowedSlotsForType(form.type).map(p => <option key={p} value={p}>{slotPreview(p)}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="Theory">Theory</option>
                  <option value="Sessional">Lab / Sessional</option>
                  <option value="Project">Project</option>
                  <option value="Tutorial">Tutorial / Section</option>
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Course</label>
                <select value={form.courseId} onChange={e => handleFormCourseChange(e.target.value)}>
                  <option value="">Select course</option>
                  {currentTermCourses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Show As (Grid Name)</label>
                <input
                  value={form.displayName}
                  onChange={e => {
                    const nextName = e.target.value;
                    set('displayName', nextName);
                    if (form.courseId) updateCourseShortName(form.courseId, nextName);
                  }}
                  placeholder={autoDisplayName(form.courseId, form.teacherName || '') || 'CSE 2201 DS'}
                />
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Room</label>
                <input value={form.room} onChange={e => set('room', e.target.value)} placeholder="Room 301" />
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Teacher (Select One)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' }}>
                  <select
                    value={form.teacherName}
                    onChange={e => set('teacherName', e.target.value)}
                    disabled={!form.courseId || getCourseTeachers(form.courseId).length === 0}
                  >
                    <option value="">Select teacher</option>
                    {getCourseTeachers(form.courseId).map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (!form.courseId) return;
                      setCourseTeacherDialogState({ open: true, courseId: form.courseId, source: 'form' });
                    }}
                    disabled={!form.courseId}
                    style={{ padding: '8px 10px', fontSize: '11px' }}
                  >
                    {!form.courseId ? 'Select Course First' : getCourseTeachers(form.courseId).length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
                  </button>
                </div>
                {form.courseId && getCourseTeachers(form.courseId).length < 2 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'rgb(180,83,9)', gridColumn: 'span 1' }}>
                    {isGroupMode ? 'This course has fewer than 2 teachers set up locally for you — you can still save using the teacher name above.' : 'Please set two teachers for this course first.'}
                  </div>
                )}
                {!form.courseId && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', gridColumn: 'span 1' }}>
                    Select a course to enable teacher setup.
                  </div>
                )}
              </div>
              <div className="form-field" style={{ gridColumn: 'span 1' }}>
                <label>Note</label>
                <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional note" />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={cancelEdit} style={{ minWidth: 110 }}>Cancel</button>
              <button className="btn btn-primary" onClick={add} style={{ minWidth: 110 }}>{editingId ? 'Save Changes' : 'Add Class'}</button>
            </div>
          </div>
        </Modal>
      )}

      <div className="card timetable-header-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="timetable-card-title" style={{ fontWeight: 700, fontSize: 15 }}>Timetable Grid</div>
            <div className="timetable-card-subtitle" style={{ fontSize: 13, color: 'var(--muted)' }}>{canEditSchedule ? 'Double-click any entry to edit.' : 'View only — your CR/ACR manages this schedule.'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}>
            {schedule.length > 0 && (
              <div className="timetable-saved-slot-count" style={{ fontSize: 12, color: 'var(--muted)' }}>{schedule.length} saved slot{schedule.length === 1 ? '' : 's'}</div>
            )}
            <button className="btn btn-ghost mobile-fullscreen-btn" onClick={() => setFullScreenOpen(true)} aria-label="Open timetable full screen">
              <span className="fs-icon" aria-hidden style={{ display: 'inline-block', lineHeight: 0 }}>
                ⤢
              </span>
              <span className="fs-label" style={{ marginLeft: 8, fontWeight: 700 }}>Full Screen</span>
            </button>
          </div>
        </div>
        <div className="mobile-preview-controls">
          <div className="schedule-status-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
            <span className="tag tag-blue">Today · {currentCalendarDay}</span>
            <span className="tag tag-green">Selected · {selectedDay}</span>
            <span className="tag tag-gray schedule-status-tag-auto">Auto · {autoPreviewDay}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {DAYS.map(day => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className="btn day-chip"
                title={day}
                style={{
                  padding: '6px 11px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: selectedDay === day ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedDay === day ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                  color: selectedDay === day ? 'var(--accent)' : 'var(--text)',
                }}
              >
                {formatDayShort(day)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {selectedClasses.length === 0 ? 'No classes added yet.' : `${selectedClasses.length} class${selectedClasses.length === 1 ? '' : 'es'} selected`}
            </div>
            <button className="btn btn-ghost" onClick={copySelectedSchedule}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: settings.messageFormat === 'whatsapp' ? 'rgba(37,211,102,0.18)' : 'rgba(59,130,246,0.14)' }}>
                <Copy size={12} />
              </span>
              <span style={{ marginLeft: 8, fontWeight: 700 }}>{selectedFormatLabel}</span>
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
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{canEditSchedule ? 'Double-click any entry to edit.' : 'View only.'}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => setFullScreenOpen(false)}>Close</button>
            </div>
            {renderTimetable({ large: true, fullView: true })}
          </div>
        </div>
      )}

      {holidaySetupOpen && (
        <Modal onClose={closeHolidaySetup} contentStyle={{
          width: 'min(600px, 100vw - 24px)',
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: 0,
          background: 'var(--bg)',
          borderRadius: 12,
          pointerEvents: 'auto',
        }}>
          <div
            className="card"
            style={{ width: '100%', padding: 16, background: 'var(--bg)', pointerEvents: 'auto', border: 'none', borderRadius: 12 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Holiday Calendar</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Friday and Saturday are always holidays. Click dates to add.</div>
              </div>
              <button className="btn btn-ghost" onClick={closeHolidaySetup}>Close</button>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
              <button
                onClick={() => setHolidayMode('calendar')}
                style={{
                  padding: '8px 12px',
                  borderBottom: holidayMode === 'calendar' ? '2px solid var(--accent)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: holidayMode === 'calendar' ? 700 : 400,
                  color: holidayMode === 'calendar' ? 'var(--accent)' : 'var(--text)',
                  fontSize: 13,
                }}
              >
                <CalendarDays size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Calendar Picker
              </button>
              <button
                onClick={() => setHolidayMode('single')}
                style={{
                  padding: '8px 12px',
                  borderBottom: holidayMode === 'single' ? '2px solid var(--accent)' : 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: holidayMode === 'single' ? 700 : 400,
                  color: holidayMode === 'single' ? 'var(--accent)' : 'var(--text)',
                  fontSize: 13,
                }}
              >
                <CalendarDays size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Single Date
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {/* Calendar Mode */}
              {holidayMode === 'calendar' && (
                <div>
                  {/* Month Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <button
                      onClick={prevMonth}
                      className="btn btn-ghost"
                      style={{ padding: '8px 12px' }}
                    >
                      ← Previous
                    </button>
                    <div style={{ fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'center' }}>
                      {monthName(calendarMonth)}
                    </div>
                    <button
                      onClick={nextMonth}
                      className="btn btn-ghost"
                      style={{ padding: '8px 12px' }}
                    >
                      Next →
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div style={{ marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', minWidth: 280, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <th
                              key={day}
                              style={{
                                padding: '8px 4px',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontSize: 12,
                                color: 'var(--muted)',
                                borderBottom: '1px solid var(--border)',
                              }}
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {renderCalendar(calendarMonth).map((week, weekIdx) => (
                          <tr key={weekIdx}>
                            {week.map((dayData, dayIdx) => {
                              const isSelected = dayData && calendarSelectedDates.has(dayData.dateStr);
                              const isInHolidays = dayData && holidayDates.includes(dayData.dateStr);
                              const isFridayOrSaturday = [5, 6].includes(dayData?.dateStr ? new Date(`${dayData.dateStr}T00:00:00`).getDay() : -1);
                              
                              return (
                                <td
                                  key={dayIdx}
                                  style={{
                                    padding: '2px',
                                    textAlign: 'center',
                                    height: 48,
                                    borderBottom: '1px solid var(--border)',
                                    borderRight: dayIdx < 6 ? '1px solid var(--border)' : 'none',
                                  }}
                                >
                                  {dayData ? (
                                    <button
                                      onClick={() => {
                                        if (isInHolidays) {
                                          removeHolidayDate(dayData.dateStr);
                                        } else {
                                          toggleCalendarDate(dayData.dateStr);
                                        }
                                      }}
                                      style={{
                                        width: '100%',
                                        minWidth: 44,
                                        height: '100%',
                                        minHeight: 44,
                                        border: isSelected ? '2px solid var(--accent)' : isInHolidays ? '2px solid rgba(34,197,94,0.5)' : '1px solid transparent',
                                        background: isSelected
                                          ? 'rgba(59,130,246,0.15)'
                                          : isInHolidays
                                          ? 'rgba(34,197,94,0.1)'
                                          : isFridayOrSaturday
                                          ? 'rgba(239,68,68,0.08)'
                                          : 'transparent',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        fontWeight: isSelected || isInHolidays ? 700 : 400,
                                        fontSize: 13,
                                        color: isFridayOrSaturday ? 'rgba(239,68,68,0.8)' : 'var(--text)',
                                        transition: 'all 0.15s ease',
                                      }}
                                      title={isFridayOrSaturday ? 'Always holiday' : isInHolidays ? 'Click to remove holiday' : 'Click to select'}
                                    >
                                      {dayData.day}
                                    </button>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Selected Count and Add Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(59,130,246,0.05)', marginBottom: 12 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>{calendarSelectedDates.size}</span>
                      <span style={{ color: 'var(--muted)' }}> date{calendarSelectedDates.size !== 1 ? 's' : ''} selected</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={addCalendarSelectedDates}
                      disabled={calendarSelectedDates.size === 0}
                    >
                      <CalendarDays size={13} /> Add to Holidays
                    </button>
                  </div>

                  {/* Legend */}
                  <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(59,130,246,0.15)', border: '2px solid var(--accent)' }} />
                      <span>Selected</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.5)' }} />
                      <span>Already added</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.8)' }}>F</div>
                      <span>Fri/Sat</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Single Date Mode */}
              {holidayMode === 'single' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Add one holiday date at a time:</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="date"
                      value={holidayDate}
                      onChange={e => setHolidayDate(e.target.value)}
                      style={{ minWidth: 170, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
                    />
                    <button className="btn btn-primary" onClick={addHolidayDate} disabled={!holidayDate}>
                      <CalendarDays size={13} /> Add Holiday
                    </button>
                  </div>
                </div>
              )}

              {/* Holiday List */}
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  Saved Holidays ({holidayDates.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {holidayDates.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>No extra holidays added yet.</div>
                  ) : (
                    holidayDates.map(date => (
                      <span key={date} className="tag tag-gray" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                        {date}
                        <button onClick={() => removeHolidayDate(date)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', padding: 0 }}>
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* === Detailed Term Roadmap (bottom of Schedule page) === */}
      <div className="card term-roadmap-card" style={{ marginTop: 14, padding: 16 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Term Roadmap</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Date-based · Holiday calendar · Exam date override</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }} onClick={openHolidaySetup}>
              <CalendarDays size={12} /> Holiday
            </button>
            {/* Term dates (classEndDate/prepLeaveEndDate/examCount/
                postExamEndDate) are CR/ACR-only now, set from the
                dedicated Class Setup page — no per-student "Configure"
                editor here anymore.
                BUGFIX: this link used to show unconditionally, so a
                regular (non-CR) student in group mode saw a "Class
                Setup" button that led to a page they had no permission
                to actually change anything on. Gated behind
                canEditSchedule now — same rule already used for Manage
                Course Teachers / Add Class / Edit Exams above. */}
            {canEditSchedule && (
              <Link to="/class-setup" className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px', textDecoration: 'none' }}>
                <Settings2 size={12} /> Class Setup
              </Link>
            )}
            {/* Exam names/dates are also CR/ACR-only now, edited from the
                same Class Setup page as every other CR input — no separate
                editor here for group classes. Personal (non-group) mode
                keeps its own local editor since there's no CR/class there. */}
            {!isGroupMode && (
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => {
                const termKey = getCurrentTermKey(profile);
                if (!effectiveTermStartDate) return notify('Term start date isn\'t set yet — ask your CR to set it in Class Setup', 'error');
                if (!termKey) return notify('Set current term in Profile first', 'error');
                const count = Math.max(1, Math.min(12, Number(roadmapConfig.examCount) || 5));
                const overrides = (effectiveExamOverrides && effectiveExamOverrides[termKey]) || [];
                const mapped = Array.from({ length: count }, (_, i) => ({
                  course: i + 1,
                  examDate: overrides[i]?.examDate || '',
                  name: overrides[i]?.name || '',
                }));
                setLocalExamEdits(mapped);
                setEditingExams(true);
              }}>
                <PencilLine size={12} /> Edit Exams
              </button>
            )}
          </div>
        </div>

        {/* Roadmap Timeline */}
        {(() => {
          const termKey = getCurrentTermKey(profile);
          const timeline = getTermTimeline(effectiveTermStartDate, profile?.dept, termKey, roadmapConfig);
          if (!timeline) {
            return (
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>
                Term start date isn't set yet — your CR sets this in Class Setup.
              </div>
            );
          }

          const overrides = (effectiveExamOverrides && effectiveExamOverrides[termKey]) || [];
          const examPhases = timeline.examPhases.map((p, i) => {
            const o = overrides[i];
            return { ...p, examDate: o && o.examDate ? new Date(o.examDate + 'T00:00:00') : null, name: o?.name || '' };
          });
          const filledExams = examPhases.filter(ep => ep.examDate);
          const lastExamDate = filledExams.length > 0 ? filledExams[filledExams.length - 1].examDate : null;
          const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

          const durationTag = timeline.durationMonths != null
            ? (timeline.durationMonths < 1.5 ? `${timeline.durationWeeks}w` : `${timeline.durationMonths}mo`)
            : null;

          const nothingSet = !roadmapConfig.classEndDate && !roadmapConfig.prepLeaveEndDate && !roadmapConfig.postExamEndDate && filledExams.length === 0;

          if (nothingSet) {
            return (
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                {canEditSchedule
                  ? <>Fill in <b>Class Setup</b>, then use <b>Edit Exams</b> to add exam dates.</>
                  : <>Ask your CR to fill in Class Setup and add exam dates.</>}
              </div>
            );
          }

          return (
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Term label + duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{profile?.currentTerm || termKey}</div>
                {durationTag && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '2px 7px' }}>
                    {durationTag} total
                  </span>
                )}
              </div>

              {/* Phase cards row 1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', opacity: roadmapConfig.classEndDate ? 1 : 0.45 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><BookOpen size={12} /> Classes</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {fmt(effectiveTermStartDate ? new Date(effectiveTermStartDate + 'T00:00:00') : null)} → {fmt(timeline.classEndDate)}
                  </div>
                  {timeline.classDays != null && (
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>{timeline.classDays} working days</div>
                  )}
                  {!roadmapConfig.classEndDate && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Set class end date ↑</div>}
                </div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', opacity: roadmapConfig.prepLeaveEndDate ? 1 : 0.45 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><GraduationCap size={12} /> Prep Leave</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {fmt(timeline.prepLeaveStart)} → {fmt(timeline.prepLeaveEnd)}
                  </div>
                  {timeline.prepLeaveDays != null && (
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>{timeline.prepLeaveDays} days</div>
                  )}
                  {!roadmapConfig.prepLeaveEndDate && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Set prep leave end ↑</div>}
                </div>
              </div>

              {/* Exams */}
              <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><PencilLine size={12} /> Exams</div>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{timeline.theoryCourses} courses</span>
                  {filledExams.length < timeline.theoryCourses && (
                    <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>
                      {timeline.theoryCourses - filledExams.length} date{timeline.theoryCourses - filledExams.length > 1 ? 's' : ''} missing
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 6 }}>
                  {examPhases.map((ep, idx) => (
                    <div key={idx} style={{ padding: '7px 10px', borderRadius: 7, background: 'var(--bg)', border: `1px solid ${ep.examDate ? 'var(--border)' : 'rgba(245,158,11,0.4)'}`, fontSize: 12 }}>
                      <div style={{ fontWeight: 700 }}>{ep.name || `Exam ${ep.course}`}</div>
                      <div style={{ color: ep.examDate ? 'var(--muted)' : '#F59E0B', fontSize: 11, marginTop: 3 }}>
                        {ep.examDate ? fmt(ep.examDate) : 'Not set'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phase cards row 2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', opacity: roadmapConfig.postExamEndDate ? 1 : 0.45 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Sprout size={12} /> Post-Exam Break</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {lastExamDate ? fmt(new Date(lastExamDate.getTime() + 86400000)) : '—'} → {fmt(timeline.postExamBreakEnd)}
                  </div>
                  {!roadmapConfig.postExamEndDate && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Set break end date ↑</div>}
                </div>
                <div style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)', opacity: timeline.nextSemesterStart ? 1 : 0.45 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><Rocket size={12} /> Next Semester</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {timeline.nextSemesterStart ? `Starts ${fmt(timeline.nextSemesterStart)}` : '—'}
                  </div>
                  {lastExamDate && (
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, fontWeight: 600 }}>
                      Last exam {fmt(lastExamDate)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={exportRoutine} style={{ justifyContent: 'center', minWidth: 140, padding: '10px 14px' }}>Export routine data</button>
          {!isGroupMode && (
            <label className="btn btn-ghost" style={{ cursor: 'pointer', justifyContent: 'center', minWidth: 140, padding: '10px 14px' }}>
              Import routine data
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
          )}
        </div>
        {importMessage && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{importMessage}</div>}
      </div>

      {/* Edit Exams Modal */}
      {editingExams && (
        <Modal onClose={() => setEditingExams(false)} className="edit-exams-modal" contentStyle={{ width: 'min(720px, 100vw - 24px)', maxWidth: '100%', background: 'var(--bg)', borderRadius: 12, padding: 16, maxHeight: '86vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', pointerEvents: 'auto' }}>
          <div className="card edit-exams-inner" style={{ width: '100%', maxWidth: '100%', background: 'var(--bg)', borderRadius: 12, padding: 16, maxHeight: '86vh', overflow: 'auto', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ fontWeight: 800 }}>Edit Exam Dates</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setEditingExams(false)}>Close</button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {localExamEdits.length > 0 ? (
                localExamEdits.map((e, i) => (
                  <div key={i} className="edit-exams-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{`Exam ${e.course}`}</div>
                    <input className="edit-exam-name" type="text" placeholder="Course name (optional)" value={e.name || ''} onChange={ev => {
                      const v = ev.target.value;
                      setLocalExamEdits(prev => prev.map((p, idx) => idx === i ? { ...p, name: v } : p));
                    }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
                    <input className="edit-exam-date" type="date" value={e.examDate} onChange={ev => {
                      const v = ev.target.value;
                      setLocalExamEdits(prev => prev.map((p, idx) => idx === i ? { ...p, examDate: v } : p));
                    }} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
                  </div>
                ))
              ) : (
                <div style={{ padding: 12, borderRadius: 10, background: 'rgba(255,235,205,0.55)', color: '#92400e', fontSize: 13 }}>
                  No exam dates are available for editing. Make sure your current term, department, and term start date are correctly set in Profile.
                </div>
              )}
            </div>

            <div className="edit-exams-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setEditingExams(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={localExamEdits.length === 0} onClick={() => {
                const termKey = getCurrentTermKey(profile);
                const next = { ...(examOverrides || {}) };
                next[termKey] = localExamEdits.map(x => ({ course: x.course, examDate: x.examDate, name: x.name || '' }));
                setExamOverrides(next);
                store.set('examOverrides', next);
                setEditingExams(false);
              }}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Form Modal */}
      {quickFormOpen && (
        <Modal onClose={closeQuickForm} contentStyle={{
          background: 'var(--card)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          padding: isFullScreenForm ? 24 : 'clamp(16px, 4vw, 20px)',
          maxWidth: isFullScreenForm ? '95vh' : 'min(calc(100vw - 24px), 420px)',
          width: isFullScreenForm ? 'min(980px, 95vh)' : '100%',
          maxHeight: isFullScreenForm ? '95vw' : '85vh',
          overflowY: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          transform: isFullScreenForm ? 'rotate(90deg)' : 'none',
          transformOrigin: 'center',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            {quickFormEditingId ? 'Quick Edit' : 'Quick Add'} · {quickFormData.day} · {slotPreview(quickFormData.slot)}
          </div>
          
          <div style={{ display: 'grid', gap: 12, marginBottom: 16, gridTemplateColumns: isFullScreenForm ? 'repeat(3, minmax(0, 1fr))' : '1fr', columnGap: 16 }}>
            {/* Course */}
            <div style={isFullScreenForm ? { gridColumn: 'span 2' } : undefined}>
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

            <div style={isFullScreenForm ? { gridColumn: 'span 1' } : undefined}>
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

            {/* Type */}
            <div style={isFullScreenForm ? { gridColumn: 'span 1' } : undefined}>
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

            <div style={isFullScreenForm ? { gridColumn: 'span 1' } : undefined}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Day</label>
              <select
                value={quickFormData.day}
                onChange={e => setQuickFormData(d => ({ ...d, day: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              >
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div style={isFullScreenForm ? { gridColumn: 'span 1' } : undefined}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Time</label>
              <select
                value={quickFormData.slot}
                onChange={e => setQuickFormData(d => ({ ...d, slot: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
              >
                {(() => {
                  const opts = getAllowedSlotsForType(quickFormData.type);
                  const extra = quickFormData._extraSlot && !opts.includes(quickFormData._extraSlot) ? quickFormData._extraSlot : null;
                  return [...(extra ? [extra] : []), ...opts].map(p => <option key={p} value={p}>{slotPreview(p)}</option>);
                })()}
              </select>
            </div>

            {/* Teacher */}
            <div style={isFullScreenForm ? { gridColumn: 'span 2' } : undefined}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Teacher (Select One)</label>
              <div style={{ display: 'grid', gridTemplateColumns: isFullScreenForm ? '1fr' : '1fr auto', gap: 8 }}>
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
                  style={{ minWidth: 120 }}
                >
                  {!quickFormData.courseId ? 'Select Course First' : getCourseTeachers(quickFormData.courseId).length >= 2 ? 'Edit Teachers' : 'Add Teacher'}
                </button>
              </div>
              {!quickFormData.courseId ? (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  Select a course first to enable teacher setup.
                </div>
              ) : getCourseTeachers(quickFormData.courseId).length < 2 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'rgb(180,83,9)' }}>
                  {isGroupMode ? 'This course has fewer than 2 teachers set up locally for you — you can still save using the teacher name above.' : 'This course needs two fixed teachers before adding class.'}
                </div>
              )}
            </div>

            {/* Room */}
            <div style={isFullScreenForm ? { gridColumn: 'span 1' } : undefined}>
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
            <div style={isFullScreenForm ? { gridColumn: 'span 3' } : undefined}>
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
              disabled={!isGroupMode && !!quickFormData.courseId && getCourseTeachers(quickFormData.courseId).length < 2}
              style={{ padding: '8px 14px' }}
            >
              {quickFormEditingId ? 'Update' : 'Add'}
            </button>
          </div>
        </Modal>
      )}

      <CourseTeacherDialog
        isOpen={courseTeacherDialogState.open}
        onClose={handleCourseTeacherDialogClose}
        course={getCourse(courseTeacherDialogState.courseId)}
        currentTeachers={getCourseTeachers(courseTeacherDialogState.courseId)}
        onSave={handleCourseTeacherDialogSave}
        allTeachers={allKnownTeachers}
        requireTwoTeachers
        source={courseTeacherDialogState.source}
        onNavigateToTeachers={() => {
          handleCourseTeacherDialogClose();
          navigate('/teachers');
        }}
      />
    </div>
  );
}