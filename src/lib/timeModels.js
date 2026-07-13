// timeModels.js
//
// Duplicated from Schedule.jsx's local (non-exported) TIME_MODELS constant
// — that file is 2600+ lines and out of scope to safely refactor as part
// of the Faculty Module's Phase 3/4 work, so rather than either (a) risk
// editing it just to add an export, or (b) invent a different slot format
// for faculty pages, this file copies the exact same data verbatim so both
// sides render identical slot labels. Flagged explicitly in PROGRESS.md as
// a known duplication — if Schedule.jsx's TIME_MODELS ever changes, this
// file needs the same edit, and a follow-up refactor to make Schedule.jsx
// import from here instead (or vice versa) would remove the duplication
// properly. Not done now because that edit is outside this module's
// stated scope.

export const TIME_MODELS = {
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

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

// ── Shared slot-range helpers ──────────────────────────────────────────
// Duplicated from Schedule.jsx's local (non-exported) versions, for the
// same reason TIME_MODELS/DAYS above are duplicated — Schedule.jsx is out
// of scope to safely refactor, so both sides use identical parsing logic
// copied verbatim rather than diverging.

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

export const parseSlotRange = (slot) => {
  const match = String(slot || '').match(/^(.+?)\s*(?:→|->|–|—|-)\s*(.+)$/);
  if (!match) return null;

  let startStr = match[1].trim();
  let endStr = match[2].trim();

  const endMeridiem = endStr.match(/\s*(AM|PM)$/i)?.[1];
  if (endMeridiem && !startStr.match(/\s*(AM|PM)$/i)) {
    startStr = `${startStr} ${endMeridiem}`;
  }

  const start = parseTimeToMinutes(startStr);
  const end = parseTimeToMinutes(endStr);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
};

export const isSlotOverlap = (a, b) => {
  const rangeA = parseSlotRange(a);
  const rangeB = parseSlotRange(b);
  if (!rangeA || !rangeB) return String(a).trim() === String(b).trim();
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
};

export const isSessionalType = (type) => /sessional|lab/i.test(String(type || ''));

// Full-block (3-period) sessional slot options — a Sessional/Lab course
// runs for 3 consecutive periods back-to-back, stored as ONE wide slot
// string (e.g. "8:00 AM-10:30 AM") rather than 3 separate dayTimeSlots
// entries. This is the exact same preset list Schedule.jsx offers
// students' CRs when they add a sessional to the class routine, so a
// teacher's own Add Class flow can offer the identical "full sessional
// block" choice instead of only ever letting them pick one bare period.
export const getPresetSessionalSlots = (modelId) => {
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

// ── Shared batch color palette ─────────────────────────────────────────
// One fixed, light color per batch — assigned by each batch's position in
// BATCH_START_DATES (store.js), so 2k23/2k24/2k25/... always land on the
// same color as long as the batch list itself doesn't get reordered.
// Lighter than the old 0.15-alpha badge palette per feedback — these are
// meant to sit as a soft background wash behind a whole card/section, not
// just a small pill, so they need to stay readable at that larger area.
const BATCH_COLOR_PALETTE = [
  { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.22)', text: 'rgb(37,99,235)' },   // blue
  { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.22)', text: 'rgb(5,150,105)' },    // green
  { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.22)', text: 'rgb(147,51,234)' },   // purple
  { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.22)', text: 'rgb(234,88,12)' },    // orange
  { bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.22)', text: 'rgb(219,39,119)' },   // pink
  { bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.22)', text: 'rgb(13,148,136)' },   // teal
];

export function getBatchColor(batch, batchList) {
  const list = batchList && batchList.length ? batchList : [];
  const idx = list.indexOf(batch);
  const safeIdx = idx >= 0 ? idx : 0;
  return BATCH_COLOR_PALETTE[safeIdx % BATCH_COLOR_PALETTE.length];
}
