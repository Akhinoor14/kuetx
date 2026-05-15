import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const inputPath = path.join(root, 'ESEcuriculumn.json');
const syllabusDir = path.join(root, 'src', 'data', 'curriculum', 'departments', 'ESE', 'syllabus');
const optionalFile = path.join(syllabusDir, 'optional.js');

const TERMS = ['Y1T1', 'Y1T2', 'Y2T1', 'Y2T2', 'Y3T1', 'Y3T2', 'Y4T1', 'Y4T2'];

const toPrettyJson = (value, indent = 2) => JSON.stringify(value, null, indent);
const q = (value) => JSON.stringify(value);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function backupSyllabusFiles() {
  const stamp = new Date().toISOString().replace(/[.:]/g, '-');
  const backupDir = path.join(root, 'src', 'data', 'curriculum', 'departments', 'ESE', `syllabus_backup_${stamp}`);
  ensureDir(backupDir);
  for (const name of fs.readdirSync(syllabusDir)) {
    const src = path.join(syllabusDir, name);
    const stat = fs.statSync(src);
    if (!stat.isFile()) continue;
    fs.copyFileSync(src, path.join(backupDir, name));
  }
  return backupDir;
}

function cleanupOldTermFiles() {
  for (const name of fs.readdirSync(syllabusDir)) {
    if (/^Y\dT\d(?:_DETAILED)?\.js$/i.test(name)) {
      fs.rmSync(path.join(syllabusDir, name), { force: true });
    }
  }
}

function writeTermFile(termKey, termData) {
  const constName = `ESE_SYLLABUS_${termKey}`;
  const outPath = path.join(syllabusDir, `${termKey}.js`);
  const payload = {
    termKey,
    title: termData?.title || '',
    courses: termData?.courses || {},
  };

  const content = `export const ${constName} = ${toPrettyJson(payload, 2)};\n`;
  fs.writeFileSync(outPath, content, 'utf8');
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—-]/g, '-')
    .trim();
}

async function writeOptionalFile(jsonRoot) {
  const moduleUrl = pathToFileURL(optionalFile).href + `?v=${Date.now()}`;
  const mod = await import(moduleUrl);
  const existing = mod.ESE_SYLLABUS_OPTIONAL || { title: 'Optional Courses', courses: {} };
  const existingCourses = { ...(existing.courses || {}) };

  const byTitle = new Map();
  for (const [code, course] of Object.entries(existingCourses)) {
    byTitle.set(normalizeTitle(course?.title), code);
  }

  const jsonOptional = jsonRoot?.terms?.Y4T2?.optionalCourses || [];
  let syntheticCounter = 1;

  for (const entry of jsonOptional) {
    const keyByTitle = byTitle.get(normalizeTitle(entry?.title));
    const code = keyByTitle || `ESE OPT ${String(syntheticCounter++).padStart(2, '0')}`;
    existingCourses[code] = {
      ...(existingCourses[code] || {}),
      title: entry?.title || existingCourses[code]?.title || code,
      credit: entry?.credit ?? existingCourses[code]?.credit,
      contactHour: entry?.contactHour ?? existingCourses[code]?.contactHour,
      topics: Array.isArray(entry?.topics) ? entry.topics : (existingCourses[code]?.topics || []),
      sessionalNote: entry?.sessionalNote ?? existingCourses[code]?.sessionalNote ?? null,
      references: Array.isArray(entry?.references) ? entry.references : (existingCourses[code]?.references || []),
    };
  }

  const optionalPayload = {
    title: existing.title || 'Optional Courses',
    courses: existingCourses,
  };

  const content = `export const ESE_SYLLABUS_OPTIONAL = ${toPrettyJson(optionalPayload, 2)};\n`;
  fs.writeFileSync(optionalFile, content, 'utf8');
}

async function main() {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const json = JSON.parse(raw);

  const backupDir = backupSyllabusFiles();
  console.log('Backup created:', path.relative(root, backupDir));

  cleanupOldTermFiles();
  console.log('Old term files removed.');

  for (const termKey of TERMS) {
    if (!json?.terms?.[termKey]) {
      console.warn(`Missing term in JSON: ${termKey}`);
      continue;
    }
    writeTermFile(termKey, json.terms[termKey]);
    console.log(`Wrote ${termKey}.js`);
  }

  await writeOptionalFile(json);
  console.log('Updated optional.js with detailed optional syllabus.');

  console.log('Import complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
