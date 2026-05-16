const path = require('path');

(async () => {
  try {
    const storePath = path.resolve(__dirname, '..', 'src', 'store', 'store.js');
    const curriculumPath = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'index.js');

    const store = await import('file://' + storePath);
    const curriculum = await import('file://' + curriculumPath);

    const TERM_KEYS = store.TERM_KEYS || ['Y1T1','Y1T2','Y2T1','Y2T2','Y3T1','Y3T2','Y4T1','Y4T2'];
    const deptList = store.DEPARTMENTS || [];
    const expectedCodes = Array.isArray(deptList) ? deptList.map(d => d.code) : [];

    const CUR = curriculum.CURRICULUM || { departments: {} };
    const found = Object.keys(CUR.departments || {});

    let problems = 0;
    console.log('Expected departments from store:', expectedCodes.join(', '));
    console.log('Departments found in curriculum:', found.join(', '));

    for (const code of expectedCodes) {
      const dept = CUR.departments?.[code];
      if (!dept) {
        console.warn(`MISSING: curriculum.departments['${code}'] not found`);
        problems++;
        continue;
      }
      const need = ['meta','terms','optional','notes','syllabus'];
      for (const k of need) {
        if (!(k in dept)) {
          console.warn(`DEPT ${code}: missing key '${k}'`);
          problems++;
        }
      }

      // syllabus shape checks
      const syl = dept.syllabus || {};
      if (typeof syl !== 'object') { console.warn(`DEPT ${code}: syllabus not an object`); problems++; }
      if (!syl.courses || typeof syl.courses !== 'object') { console.warn(`DEPT ${code}: syllabus.courses missing or not object`); problems++; }
      if (!syl.terms || typeof syl.terms !== 'object') { console.warn(`DEPT ${code}: syllabus.terms missing or not object`); problems++; }

      // term count vs TERM_KEYS
      const termKeys = Object.keys(syl.terms || {});
      if (termKeys.length !== TERM_KEYS.length) {
        console.warn(`DEPT ${code}: syllabus.terms length ${termKeys.length} !== expected ${TERM_KEYS.length}`);
        problems++;
      }
    }

    // check for extraneous departments in curriculum
    for (const code of found) {
      if (!expectedCodes.includes(code)) {
        console.warn(`EXTRA: curriculum has department '${code}' not listed in store.DEPARTMENTS`);
        problems++;
      }
    }

    if (problems === 0) {
      console.log('Validation passed: curriculum shape looks good.');
      process.exit(0);
    }
    console.log(`Validation found ${problems} issues.`);
    process.exit(2);
  } catch (e) {
    console.error('Validation failed with error:', e);
    process.exit(3);
  }
})();
