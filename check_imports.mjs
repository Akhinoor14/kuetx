#!/usr/bin/env node
// Usage: node check_imports.mjs
// Run from your project root (where src/ lives).
// Scans all .js/.jsx files for relative imports and verifies the target exists.

import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');
const exts = ['.js', '.jsx', '.ts', '.tsx'];
const importRe = /(?:import\s+[^'"]*from\s+|import\s*\(|require\()\s*['"](\.[^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function resolves(baseDir, importPath) {
  const target = path.resolve(baseDir, importPath);
  if (fs.existsSync(target)) return true;
  for (const ext of exts) {
    if (fs.existsSync(target + ext)) return true;
  }
  for (const ext of exts) {
    if (fs.existsSync(path.join(target, 'index' + ext))) return true;
  }
  return false;
}

let brokenCount = 0;
const files = walk(SRC);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  importRe.lastIndex = 0;
  while ((match = importRe.exec(content))) {
    const importPath = match[1];
    const baseDir = path.dirname(file);
    if (!resolves(baseDir, importPath)) {
      brokenCount++;
      console.log(`✗ ${path.relative(process.cwd(), file)}`);
      console.log(`    imports "${importPath}" — not found`);
    }
  }
}

console.log('');
if (brokenCount === 0) {
  console.log('✓ All relative imports resolved.');
} else {
  console.log(`✗ ${brokenCount} broken import(s) found.`);
  process.exit(1);
}
