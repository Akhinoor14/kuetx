import { ME_META } from './meta.js';
import { ME_TERMS } from './terms/index.js';
import { ME_OPTIONAL_COURSES } from './optional.js';
import { ME_NOTES } from './notes.js';
import { ME_SYLLABUS } from './syllabus/index.js';

export const ME_DEPARTMENT = {
  meta: ME_META,
  terms: ME_TERMS,
  optional: ME_OPTIONAL_COURSES,
  notes: ME_NOTES,
  syllabus: ME_SYLLABUS,
};

export default ME_DEPARTMENT;
