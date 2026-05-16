import { LE_SYLLABUS_Y1_1 } from './Y1T1.js';
import { LE_SYLLABUS_Y1_2 } from './Y1T2.js';
import { LE_SYLLABUS_Y2_1 } from './Y2T1.js';
import { LE_SYLLABUS_Y2_2 } from './Y2T2.js';
import { LE_SYLLABUS_Y3_1 } from './Y3T1.js';
import { LE_SYLLABUS_Y3_2 } from './Y3T2.js';
import { LE_SYLLABUS_Y4_1 } from './Y4T1.js';
import { LE_SYLLABUS_Y4_2 } from './Y4T2.js';

const TERM_SYLLABUS = {
  'Y1T1': LE_SYLLABUS_Y1_1,
  'Y1T2': LE_SYLLABUS_Y1_2,
  'Y2T1': LE_SYLLABUS_Y2_1,
  'Y2T2': LE_SYLLABUS_Y2_2,
  'Y3T1': LE_SYLLABUS_Y3_1,
  'Y3T2': LE_SYLLABUS_Y3_2,
  'Y4T1': LE_SYLLABUS_Y4_1,
  'Y4T2': LE_SYLLABUS_Y4_2
};

const mergeCourses = () => {
  const all = {};
  Object.values(TERM_SYLLABUS).forEach(term => {
    Object.assign(all, term.courses);
  });
  return all;
};

export const LE_SYLLABUS = {
  sourceFile: 'src/data/curriculum/departments/LE/syllabus/index.js',
  terms: TERM_SYLLABUS,
  courses: mergeCourses()
};

export default LE_SYLLABUS;
