export { default as EEE_SYLLABUS_Y1T1 } from './Y1T1.js';
export { default as EEE_SYLLABUS_Y1T2 } from './Y1T2.js';
export { default as EEE_SYLLABUS_Y2T1 } from './Y2T1.js';
export { default as EEE_SYLLABUS_Y2T2 } from './Y2T2.js';
export { default as EEE_SYLLABUS_Y3T1 } from './Y3T1.js';
export { default as EEE_SYLLABUS_Y3T2 } from './Y3T2.js';
export { default as EEE_SYLLABUS_Y4T1 } from './Y4T1.js';
export { default as EEE_SYLLABUS_Y4T2 } from './Y4T2.js';

export const EEE_SYLLABUS = {
  Y1T1: require('./Y1T1.js').default,
  Y1T2: require('./Y1T2.js').default,
  Y2T1: require('./Y2T1.js').default,
  Y2T2: require('./Y2T2.js').default,
  Y3T1: require('./Y3T1.js').default,
  Y3T2: require('./Y3T2.js').default,
  Y4T1: require('./Y4T1.js').default,
  Y4T2: require('./Y4T2.js').default,
};

export default EEE_SYLLABUS;
