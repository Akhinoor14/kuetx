const makeTerm = (termKey, title) => ({
  termKey,
  title,
  courses: {},
  optionalCourses: [],
  termNotes: [],
});

const TERM_SYLLABUS = {
  Y1T1: makeTerm('Y1T1', 'First Year First Term'),
  Y1T2: makeTerm('Y1T2', 'First Year Second Term'),
  Y2T1: makeTerm('Y2T1', 'Second Year First Term'),
  Y2T2: makeTerm('Y2T2', 'Second Year Second Term'),
  Y3T1: makeTerm('Y3T1', 'Third Year First Term'),
  Y3T2: makeTerm('Y3T2', 'Third Year Second Term'),
  Y4T1: makeTerm('Y4T1', 'Fourth Year First Term'),
  Y4T2: makeTerm('Y4T2', 'Fourth Year Second Term'),
};

export const BECM_SYLLABUS = {
  terms: TERM_SYLLABUS,
  courses: {},
};

export default BECM_SYLLABUS;
