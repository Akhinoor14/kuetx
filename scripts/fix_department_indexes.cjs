const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const storePath = path.resolve(__dirname, '..', 'src', 'store', 'store.js');
    const store = await import('file://' + storePath);
    const DEPARTMENTS = store.DEPARTMENTS || [];

    const base = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments');

    for (const d of DEPARTMENTS) {
      const code = d.code;
      const dir = path.join(base, code);
      if (!fs.existsSync(dir)) continue;

      const parts = [];
      const hasMeta = fs.existsSync(path.join(dir, 'meta.js'));
      const hasTerms = fs.existsSync(path.join(dir, 'terms', 'index.js'));
      const hasOptional = fs.existsSync(path.join(dir, 'optional.js'));
      const hasNotes = fs.existsSync(path.join(dir, 'notes.js'));
      const hasSyllabus = fs.existsSync(path.join(dir, 'syllabus', 'index.js'));

      if (hasMeta) parts.push(`import { ${code}_META } from './meta.js';`);
      if (hasTerms) parts.push(`import { ${code}_TERMS } from './terms/index.js';`);
      if (hasOptional) parts.push(`import { ${code}_OPTIONAL_COURSES } from './optional.js';`);
      if (hasNotes) parts.push(`import { ${code}_NOTES } from './notes.js';`);
      if (hasSyllabus) parts.push(`import { ${code}_SYLLABUS } from './syllabus/index.js';`);

      const metaRef = hasMeta ? `${code}_META` : `{ code: '${code}', name: ${JSON.stringify(d.name || code)} }`;
      const termsRef = hasTerms ? `${code}_TERMS` : '{}';
      const optionalRef = hasOptional ? `${code}_OPTIONAL_COURSES` : '[]';
      const notesRef = hasNotes ? `${code}_NOTES` : '{}';
      const syllabusRef = hasSyllabus ? `${code}_SYLLABUS` : '{ terms: {}, courses: {} }';

      const content = `${parts.join('\n')}\n\nexport const ${code}_DEPARTMENT = {\n  meta: ${metaRef},\n  terms: ${termsRef},\n  optional: ${optionalRef},\n  notes: ${notesRef},\n  syllabus: ${syllabusRef},\n};\n`;

      fs.writeFileSync(path.join(dir, 'index.js'), content, 'utf8');
      console.log('Wrote department index:', path.join(dir, 'index.js'));
    }

    process.exit(0);
  } catch (e) {
    console.error('Error fixing indexes:', e);
    process.exit(1);
  }
})();
