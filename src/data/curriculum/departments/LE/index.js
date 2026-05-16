import { LE_TERMS } from './terms/index.js';
import { LE_OPTIONAL_COURSES } from './optional.js';
import { LE_NOTES } from './notes.js';
import { LE_SYLLABUS } from './syllabus/index.js';

export const LE_META = {
  code: 'LE',
  name: 'Department of Leather Engineering',
  acronym: 'LE'
};

export const LE_DEPARTMENT = {
  meta: LE_META,
  terms: LE_TERMS,
  optional: LE_OPTIONAL_COURSES,
  notes: LE_NOTES,
  syllabus: LE_SYLLABUS,
};

export default LE_DEPARTMENT;
