import Y1T1 from './Y1T1.js';
import Y1T2 from './Y1T2.js';
import Y2T1 from './Y2T1.js';
import Y2T2 from './Y2T2.js';
import Y3T1 from './Y3T1.js';
import Y3T2 from './Y3T2.js';
import Y4T1 from './Y4T1.js';
import Y4T2 from './Y4T2.js';

const TERM_SYLLABUS = {
  Y1T1,
  Y1T2,
  Y2T1,
  Y2T2,
  Y3T1,
  Y3T2,
  Y4T1,
  Y4T2,
};

const mergeCourses = () => {
  const all = {};
  Object.values(TERM_SYLLABUS).forEach(term => { Object.assign(all, term.courses); });
  return all;
};

export const EEE_SYLLABUS = {
  sourceFile: 'src/data/curriculum/departments/EEE/syllabus/index.js',
  terms: TERM_SYLLABUS,
  courses: mergeCourses(),
};

export default EEE_SYLLABUS;
