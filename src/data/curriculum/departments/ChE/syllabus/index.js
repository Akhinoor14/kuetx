import { ChE_SYLLABUS_Y1T1 } from './Y1T1.js';
import { ChE_SYLLABUS_Y1T2 } from './Y1T2.js';
import { ChE_SYLLABUS_Y2T1 } from './Y2T1.js';
import { ChE_SYLLABUS_Y2T2 } from './Y2T2.js';
import { ChE_SYLLABUS_Y3T1 } from './Y3T1.js';
import { ChE_SYLLABUS_Y3T2 } from './Y3T2.js';
import { ChE_SYLLABUS_Y4T1 } from './Y4T1.js';
import { ChE_SYLLABUS_Y4T2 } from './Y4T2.js';
import { ChE_SYLLABUS_OPTIONAL } from './optional.js';

const TERM_SYLLABUS = {
  Y1T1: ChE_SYLLABUS_Y1T1,
  Y1T2: ChE_SYLLABUS_Y1T2,
  Y2T1: ChE_SYLLABUS_Y2T1,
  Y2T2: ChE_SYLLABUS_Y2T2,
  Y3T1: ChE_SYLLABUS_Y3T1,
  Y3T2: ChE_SYLLABUS_Y3T2,
  Y4T1: ChE_SYLLABUS_Y4T1,
  Y4T2: ChE_SYLLABUS_Y4T2,
};

const mergeCourses = (...terms) => terms.reduce((acc, term) => ({ ...acc, ...term.courses }), {});

export const ChE_SYLLABUS = {
  sourceFile: '',
  terms: TERM_SYLLABUS,
  optional: ChE_SYLLABUS_OPTIONAL,
  courses: { ...mergeCourses(ChE_SYLLABUS_Y1T1, ChE_SYLLABUS_Y1T2, ChE_SYLLABUS_Y2T1, ChE_SYLLABUS_Y2T2, ChE_SYLLABUS_Y3T1, ChE_SYLLABUS_Y3T2, ChE_SYLLABUS_Y4T1, ChE_SYLLABUS_Y4T2), ...ChE_SYLLABUS_OPTIONAL.courses },
};
