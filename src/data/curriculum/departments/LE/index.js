import { LE_TERMS } from './terms/index.js';
import { LE_OPTIONAL_COURSES } from './optional.js';
import { LE_NOTES } from './notes.js';
import { LE_SYLLABUS } from './syllabus/index.js';

export const LE_DEPARTMENT = {
  meta: { code: 'LE', name: "Leather Engineering" },
  terms: LE_TERMS,
  optional: LE_OPTIONAL_COURSES,
  notes: LE_NOTES,
  syllabus: LE_SYLLABUS,
};
