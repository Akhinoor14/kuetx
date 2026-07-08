import { Arch_META } from './meta.js';
import { Arch_TERMS } from './terms/index.js';
import { Arch_OPTIONAL_COURSES } from './optional.js';
import { Arch_NOTES } from './notes.js';
import { Arch_SYLLABUS } from './syllabus/index.js';

export const Arch_DEPARTMENT = {
  meta: Arch_META,
  terms: Arch_TERMS,
  optional: Arch_OPTIONAL_COURSES,
  notes: Arch_NOTES,
  syllabus: Arch_SYLLABUS,
};

export default Arch_DEPARTMENT;
