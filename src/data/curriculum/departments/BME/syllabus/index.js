import { BME_SYLLABUS_Y1T1 } from './Y1T1.js';
import { BME_SYLLABUS_Y1T2 } from './Y1T2.js';
import { BME_SYLLABUS_Y2T1 } from './Y2T1.js';
import { BME_SYLLABUS_Y2T2 } from './Y2T2.js';
import { BME_SYLLABUS_Y3T1 } from './Y3T1.js';
import { BME_SYLLABUS_Y3T2 } from './Y3T2.js';
import { BME_SYLLABUS_Y4T1 } from './Y4T1.js';
import { BME_SYLLABUS_Y4T2 } from './Y4T2.js';
import { BME_OPTIONAL_COURSES } from '../optional.js';

const termKeys = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

const TERM_SOURCE = {
  Y1T1: BME_SYLLABUS_Y1T1,
  Y1T2: BME_SYLLABUS_Y1T2,
  Y2T1: BME_SYLLABUS_Y2T1,
  Y2T2: BME_SYLLABUS_Y2T2,
  Y3T1: BME_SYLLABUS_Y3T1,
  Y3T2: BME_SYLLABUS_Y3T2,
  Y4T1: BME_SYLLABUS_Y4T1,
  Y4T2: BME_SYLLABUS_Y4T2,
};

const mapOptional = (optionalCourses, termKey) => (optionalCourses || []).map(course => ({
  code: course.code,
  title: course.title,
  credit: course.credit,
  contactHour: course.contactHours || '3 Hrs/week',
  topics: course.topics || [],
  sessionalNote: course.sessionalNote || null,
  references: course.references || [],
  isOptional: true,
  optionalGroup: course.group || null,
  term: termKey,
}));

const mapTerm = (termKey) => {
  const term = TERM_SOURCE[termKey] || { termKey, title: '', courses: {}, optionalCourses: [], termNotes: [] };
  const courses = Object.entries(term.courses || {}).reduce((acc, [code, info]) => {
    acc[code] = {
      title: info.title,
      credit: info.credit,
      contactHour: info.contactHour,
      topics: info.topics || [],
      sessionalNote: info.sessionalNote || null,
      references: info.references || [],
    };
    return acc;
  }, {});

  const optionalCourses = mapOptional(term.optionalCourses, termKey);

  return {
    termKey: term.termKey || termKey,
    title: term.title || '',
    courses: {
      ...courses,
      ...optionalCourses.reduce((acc, course) => {
        acc[course.code] = {
          title: course.title,
          credit: course.credit,
          contactHour: course.contactHour,
          topics: course.topics,
          sessionalNote: course.sessionalNote,
          references: course.references,
          isOptional: true,
        };
        return acc;
      }, {}),
    },
    optionalCourses,
    termNotes: term.termNotes || [],
  };
};

const TERM_SYLLABUS = termKeys.reduce((acc, key) => {
  acc[key] = mapTerm(key);
  return acc;
}, {});

const mergeCourses = (...terms) => terms.reduce((acc, term) => ({ ...acc, ...term.courses }), {});

export const BME_SYLLABUS = {
  sourceFile: 'src/data/curriculum/departments/BME/syllabus/index.js',
  terms: TERM_SYLLABUS,
  optional: BME_OPTIONAL_COURSES,
  courses: mergeCourses(...termKeys.map(key => TERM_SYLLABUS[key])),
};

export default BME_SYLLABUS;
