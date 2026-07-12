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
