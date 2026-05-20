const fs = require('fs').promises;
const path = require('path');

async function walk(dir) {
  let results = [];
  try {
    const entries = await fs.readdir(dir);
    for (const e of entries) {
      const full = path.join(dir, e);
      const s = await fs.stat(full);
      if (s.isDirectory()) {
        results = results.concat(await walk(full));
      } else if (s.isFile() && full.toLowerCase().endsWith('.pdf')) {
        results.push(full);
      }
    }
  } catch (err) {
    // ignore
  }
  return results;
}

(async function main(){
  const scriptDir = __dirname;
  const target = path.resolve(scriptDir, '..', 'src', 'data', 'QUESTION Bank');
  console.log('Target:', target);
  const pdfs = await walk(target);
  console.log('Found PDFs:', pdfs.length);
  let deleted = 0, skipped = 0, missingBackup = 0;
  for (const pdf of pdfs) {
    const backup = pdf + '.zst';
    try {
      await fs.access(backup);
      // backup exists => delete original
      await fs.unlink(pdf);
      deleted++;
      if (deleted % 50 === 0) console.log('Deleted', deleted);
    } catch (err) {
      // backup missing or deletion failed
      if (err.code === 'ENOENT') missingBackup++;
      else {
        console.error('Failed to delete', pdf, err.message);
        skipped++;
      }
    }
  }
  const summary = { totalFound: pdfs.length, deleted, missingBackup, skipped };
  const out = path.resolve(scriptDir, 'remove_original_pdfs_report.json');
  await fs.writeFile(out, JSON.stringify(summary, null, 2), 'utf8');
  console.log('Summary:', summary);
  console.log('Wrote report to', out);
})();
