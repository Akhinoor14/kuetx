const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const storePath = path.resolve(__dirname, '..', 'src', 'store', 'store.js');
    const store = await import('file://' + storePath);
    const DEPARTMENTS = store.DEPARTMENTS || [];

    const base = path.resolve(__dirname, '..', 'src', 'data', 'curriculum', 'departments');
    if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

    for (const d of DEPARTMENTS) {
      const code = d.code;
      const name = d.name || code;
      const dir = path.join(base, code);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const idx = path.join(dir, 'index.js');
      if (!fs.existsSync(idx)) {
        const content = `export const ${code}_DEPARTMENT = {
  meta: { code: '${code}', name: ${JSON.stringify(name)} },
  terms: {},
  optional: [],
  notes: {},
  syllabus: { terms: {}, courses: {} },
};\n`;
        fs.writeFileSync(idx, content, 'utf8');
        console.log('Created stub:', idx);
      } else {
        console.log('Exists:', idx);
      }
    }

    // Generate central index.js to import all
    const imports = DEPARTMENTS.map(d => `import { ${d.code}_DEPARTMENT as ${d.code} } from './${d.code}/index.js';`).join('\n');
    const mapping = `export const DEPARTMENTS = {\n${DEPARTMENTS.map(d => `  ${d.code},`).join('\n')}\n};\n`;
    const out = `${imports}\n\n${mapping}`;
    const outPath = path.join(base, 'index.js');
    fs.writeFileSync(outPath, out, 'utf8');
    console.log('Wrote departments index to', outPath);
    process.exit(0);
  } catch (e) {
    console.error('Error creating stubs:', e);
    process.exit(1);
  }
})();
