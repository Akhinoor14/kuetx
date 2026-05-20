const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', 'src', 'data', 'QUESTION Bank');
const outFile = path.join(rootDir, 'question_bank_structure.json');

function buildNode(filePath) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const children = fs.readdirSync(filePath).sort().map(name => buildNode(path.join(filePath, name)));
    return {
      name: path.basename(filePath),
      type: 'directory',
      relative_path: path.relative(process.cwd(), filePath).split(path.sep).join('/'),
      absolute_path: filePath,
      children,
    };
  } else {
    return {
      name: path.basename(filePath),
      type: 'file',
      relative_path: path.relative(process.cwd(), filePath).split(path.sep).join('/'),
      absolute_path: filePath,
      size: stat.size,
    };
  }
}

try {
  if (!fs.existsSync(rootDir)) throw new Error('Root directory not found: ' + rootDir);
  const tree = buildNode(rootDir);
  fs.writeFileSync(outFile, JSON.stringify(tree, null, 2), 'utf8');
  console.log('Wrote', outFile);
} catch (err) {
  console.error(err && err.stack || err);
  process.exit(1);
}
