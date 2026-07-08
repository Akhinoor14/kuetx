import { TE_META } from './meta.js';
import { TE_TERMS } from './terms/index.js';
import { TE_OPTIONAL_COURSES } from './optional.js';
import { TE_NOTES } from './notes.js';
import { TE_SYLLABUS } from './syllabus/index.js';

export const TE_DEPARTMENT = {
  meta: TE_META,
  terms: TE_TERMS,
  optional: TE_OPTIONAL_COURSES,
  notes: TE_NOTES,
  syllabus: TE_SYLLABUS,
};

export default TE_DEPARTMENT;
