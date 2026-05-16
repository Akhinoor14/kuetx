const fs = require('fs');
const path = require('path');

const TERM_KEYS = ['Y1T1','Y1T2','Y2T1','Y2T2','Y3T1','Y3T2','Y4T1','Y4T2'];

(async () => {
  try {
    const storePath = path.resolve(__dirname, '..', 'src', 'store', 'store.js');
    const store = await import('file://' + storePath);
    const DEPARTMENTS = store.DEPARTMENTS || [];

    const base = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments');

    for (const d of DEPARTMENTS) {
      const code = d.code;
      const deptDir = path.join(base, code);
      if (!fs.existsSync(deptDir)) fs.mkdirSync(deptDir, { recursive: true });

      // Terms folder
      const termsDir = path.join(deptDir, 'terms');
      if (!fs.existsSync(termsDir)) fs.mkdirSync(termsDir, { recursive: true });
      const termFiles = [];
      for (const k of TERM_KEYS) {
        const file = path.join(termsDir, `${k}.js`);
        termFiles.push(k);
        if (!fs.existsSync(file)) {
          const content = `export const ${k} = [];\n`;
          fs.writeFileSync(file, content, 'utf8');
          console.log(`Created terms stub: ${file}`);
        }
      }
      // terms/index.js
      const termsIndexPath = path.join(termsDir, 'index.js');
      if (!fs.existsSync(termsIndexPath)) {
        const imports = TERM_KEYS.map(k => `import { ${k} } from './${k}.js';`).join('\n');
        const mapping = `export const ${code}_TERMS = {\n  ${TERM_KEYS.join(',\n  ')}\n};\n`;
        const out = `${imports}\n\n${mapping}`;
        fs.writeFileSync(termsIndexPath, out, 'utf8');
        console.log(`Wrote terms index: ${termsIndexPath}`);
      }

      // Syllabus folder
      const sylDir = path.join(deptDir, 'syllabus');
      if (!fs.existsSync(sylDir)) fs.mkdirSync(sylDir, { recursive: true });
      const sylTermNames = [];
      for (const k of TERM_KEYS) {
        const file = path.join(sylDir, `${k}.js`);
        sylTermNames.push(k);
        if (!fs.existsSync(file)) {
          const varName = `${code}_SYLLABUS_${k}`;
          const content = `export const ${varName} = { title: '', courses: {} };\n`;
          fs.writeFileSync(file, content, 'utf8');
          console.log(`Created syllabus term stub: ${file}`);
        }
      }

      // optional.js
      const optionalPath = path.join(sylDir, 'optional.js');
      if (!fs.existsSync(optionalPath)) {
        const varName = `${code}_SYLLABUS_OPTIONAL`;
        const content = `export const ${varName} = { title: 'Optional', courses: {} };\n`;
        fs.writeFileSync(optionalPath, content, 'utf8');
        console.log(`Created syllabus optional: ${optionalPath}`);
      }

      // syllabus/index.js
      const sylIndexPath = path.join(sylDir, 'index.js');
      if (!fs.existsSync(sylIndexPath)) {
        const imports = TERM_KEYS.map(k => `import { ${code}_SYLLABUS_${k} } from './${k}.js';`).join('\n');
        const optImport = `import { ${code}_SYLLABUS_OPTIONAL } from './optional.js';`;
        const termObj = `const TERM_SYLLABUS = {\n${TERM_KEYS.map(k => `  ${k}: ${code}_SYLLABUS_${k},`).join('\n')}\n};`;
        const mergeFn = `const mergeCourses = (...terms) => terms.reduce((acc, term) => ({ ...acc, ...term.courses }), {});`;
        const out = `${imports}\n${optImport}\n\n${termObj}\n\n${mergeFn}\n\nexport const ${code}_SYLLABUS = {\n  sourceFile: '',\n  terms: TERM_SYLLABUS,\n  optional: ${code}_SYLLABUS_OPTIONAL,\n  courses: { ...mergeCourses(${TERM_KEYS.map(k => `${code}_SYLLABUS_${k}`).join(', ')}), ...${code}_SYLLABUS_OPTIONAL.courses },\n};\n`;
        fs.writeFileSync(sylIndexPath, out, 'utf8');
        console.log(`Wrote syllabus index: ${sylIndexPath}`);
      }
    }

    console.log('Population complete.');
    process.exit(0);
  } catch (e) {
    console.error('Error populating stubs:', e);
    process.exit(1);
  }
})();
