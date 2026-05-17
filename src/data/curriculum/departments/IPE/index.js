import { IPE_META } from './meta.js';
import { IPE_TERMS } from './terms/index.js';
import { IPE_OPTIONAL_COURSES } from './optional.js';
import { IPE_NOTES } from './notes.js';
import { IPE_SYLLABUS } from './syllabus/index.js';

export const IPE_DEPARTMENT = {
  meta: IPE_META,
  terms: IPE_TERMS,
  optional: IPE_OPTIONAL_COURSES,
  notes: IPE_NOTES,
  syllabus: IPE_SYLLABUS,
};

export default IPE_DEPARTMENT;
