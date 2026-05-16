const fs = require('fs');
const path = require('path');

const TERM_KEYS = ['Y1T1','Y1T2','Y2T1','Y2T2','Y3T1','Y3T2','Y4T1','Y4T2'];

(async () => {
  try {
    const storePath = path.resolve(__dirname, '..', 'src', 'store', 'store.js');
    const curriculumPath = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'index.js');
    const store = await import('file://' + storePath);
    const curriculum = await import('file://' + curriculumPath);

    const CUR = curriculum.CURRICULUM || { departments: {} };
    const DEPARTMENTS = store.DEPARTMENTS || [];
    const { inferCourseTypeFromCode } = store;
    const base = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments');

    for (const d of DEPARTMENTS) {
      const code = d.code;
      const dept = CUR.departments?.[code];
      if (!dept) continue;
      const syl = dept.syllabus || {};
      if (!syl.terms) continue;

      const termsDir = path.join(base, code, 'terms');
      if (!fs.existsSync(termsDir)) fs.mkdirSync(termsDir, { recursive: true });

      for (const k of TERM_KEYS) {
        const termObj = syl.terms[k];
        if (!termObj) continue;
        const coursesObj = termObj.courses || {};
        const arr = Object.entries(coursesObj).map(([codeKey, info]) => ({
          code: codeKey,
          title: info.title || info.name || '',
          credits: info.credit ?? info.credits ?? 0,
          contactHours: info.contactHour || info.contactHours || '',
          type: inferCourseTypeFromCode ? inferCourseTypeFromCode(codeKey, info.type) : (info.type || (info.sessionalNote ? 'Sessional' : 'Theory')),
          isOptional: !!info.isOptional,
        }));

        const outFile = path.join(termsDir, `${k}.js`);
        const content = `export const ${k} = ${JSON.stringify(arr, null, 2)};\n`;
        fs.writeFileSync(outFile, content, 'utf8');
        console.log(`Wrote ${outFile} (${arr.length} entries)`);
      }

      // ensure terms/index.js exists and exports
      const idx = path.join(termsDir, 'index.js');
      const imports = TERM_KEYS.map(k => `import { ${k} } from './${k}.js';`).join('\n');
      const mapping = `export const ${code}_TERMS = {\n${TERM_KEYS.map(k => `  ${k},`).join('\n')}\n};\n`;
      fs.writeFileSync(idx, `${imports}\n\n${mapping}`, 'utf8');
      console.log(`Ensured terms index for ${code}`);
    }

    console.log('Persisted syllabus to terms for departments with syllabus data.');
    process.exit(0);
  } catch (e) {
    console.error('Error persisting syllabus to terms:', e);
    process.exit(1);
  }
})();
