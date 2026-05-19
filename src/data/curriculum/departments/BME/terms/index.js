import { BME_TERMS_Y1T1 } from './Y1T1.js';
import { BME_TERMS_Y1T2 } from './Y1T2.js';
import { BME_TERMS_Y2T1 } from './Y2T1.js';
import { BME_TERMS_Y2T2 } from './Y2T2.js';
import { BME_TERMS_Y3T1 } from './Y3T1.js';
import { BME_TERMS_Y3T2 } from './Y3T2.js';
import { BME_TERMS_Y4T1 } from './Y4T1.js';
import { BME_TERMS_Y4T2 } from './Y4T2.js';

const toTermCourses = (term) => Object.entries(term.courses || {}).map(([code, info]) => ({
  code,
  title: info.title,
  credits: info.credit,
  contactHours: info.contactHour,
  type: info.sessionalNote ? 'Sessional' : 'Theory',
  isOptional: false,
}));

export const BME_TERMS = {
  Y1T1: toTermCourses(BME_TERMS_Y1T1),
  Y1T2: toTermCourses(BME_TERMS_Y1T2),
  Y2T1: toTermCourses(BME_TERMS_Y2T1),
  Y2T2: toTermCourses(BME_TERMS_Y2T2),
  Y3T1: toTermCourses(BME_TERMS_Y3T1),
  Y3T2: toTermCourses(BME_TERMS_Y3T2),
  Y4T1: toTermCourses(BME_TERMS_Y4T1),
  Y4T2: toTermCourses(BME_TERMS_Y4T2),
};

export default BME_TERMS;
