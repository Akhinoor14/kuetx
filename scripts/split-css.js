#!/usr/bin/env node
/**
 * KUETx CSS Auto-Splitter - Node.js Version
 * Reads old index.css and splits into organized structure
 */

const fs = require('fs');
const path = require('path');

// Page name patterns to extract
const PAGE_PATTERNS = {
  'self-eval': /\.self-eval-page/,
  'dashboard': /\.dashboard-page/,
  'assignments': /\.assignments-page/,
  'attendance': /\.attendance-page/,
  'question-bank': /\.qb2-page|\.qb2-view|\.qb2-filter|\.qb2-modal/,
  'settings': /\.settings-modal/,
  'profile': /\.profile-cr-pill/,
  'general': /\.mobile-bottom-nav-panel|\.kuet-table|\.topbar-page-title/
};

const CSS_FILE = 'src/index.css';
const OUTPUT_BASE = 'src/styles';

function parseCSS(content) {
  // Remove @tailwind directives
  let css = content.replace(/@tailwind\s+[^;]+;/g, '');
  
  // Extract :root variables separately
  const rootMatch = css.match(/:root\s*\{[^}]*\}/s);
  
  const rules = [];
  let i = 0;
  
  while (i < css.length) {
    // Skip comments
    if (css[i] === '/' && css[i+1] === '*') {
      const end = css.indexOf('*/', i);
      if (end > -1) {
        i = end + 2;
      } else {
        break;
      }
      continue;
    }
    
    // Skip whitespace
    if (/\s/.test(css[i])) {
      i++;
      continue;
    }
    
    // Find selector and block
    const bracePos = css.indexOf('{', i);
    if (bracePos === -1) break;
    
    const selector = css.substring(i, bracePos).trim();
    
    // Find matching closing brace (handle nested)
    let braceCount = 1;
    let j = bracePos + 1;
    while (j < css.length && braceCount > 0) {
      if (css[j] === '{') braceCount++;
      if (css[j] === '}') braceCount--;
      if (css[j] === '"') {
        j++;
        while (j < css.length && css[j] !== '"') {
          if (css[j] === '\\') j++;
          j++;
        }
      }
      j++;
    }
    
    if (braceCount === 0) {
      const rule = css.substring(i, j).trim();
      if (rule && !rule.includes('@tailwind')) {
        rules.push({ selector, rule });
      }
      i = j;
    } else {
      break;
    }
  }
  
  return rules;
}

function categorizeRule(selector, rule) {
  // Check page patterns
  for (const [page, pattern] of Object.entries(PAGE_PATTERNS)) {
    if (pattern.test(selector)) {
      return `pages/${page}.css`;
    }
  }
  
  // Component detection
  if (/^\.btn|^\.button/.test(selector)) return 'components/buttons.css';
  if (/^\.card|^\.alert/.test(selector)) return 'components/cards.css';
  if (/^\.input|^\.form|^\.select|^\.textarea/.test(selector)) return 'components/inputs.css';
  if (/^\.tag|^\.badge/.test(selector)) return 'components/tags.css';
  if (/^\.modal|^\.drawer/.test(selector)) return 'components/modal.css';
  if (/^\.progress/.test(selector)) return 'components/progress.css';
  if (/^\.nav|^\.navbar/.test(selector)) return 'components/nav.css';
  
  // Utils/Base detection
  if (selector === ':root' || selector.includes('prefers-color-scheme')) {
    return 'base/themes.css';
  }
  if (/^(html|body|\*|reset)/.test(selector)) return 'base/reset.css';
  if (/^(h[1-6]|p|body)\s|^h[1-6]|^p|typography|font|text-/.test(selector)) {
    return 'base/typography.css';
  }
  if (/@keyframes|animation/.test(rule)) return 'utils/animations.css';
  if (/\.container|\.grid|\.flex|\.page-/.test(selector)) return 'utils/layout.css';
  if (/pwa|install/.test(selector)) return 'utils/pwa.css';
  
  return 'utils/layout.css';
}

function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      KUETx Complete CSS Auto-Split (Node.js)              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Read CSS
  console.log(`📖 Reading ${CSS_FILE}...`);
  if (!fs.existsSync(CSS_FILE)) {
    console.log(`   ❌ File not found: ${CSS_FILE}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(CSS_FILE, 'utf-8');
  const originalSize = content.length;
  console.log(`   ✅ Read ${originalSize.toLocaleString()} bytes\n`);
  
  // Parse CSS
  console.log('🔍 Parsing CSS rules...');
  const rules = parseCSS(content);
  console.log(`   📊 Found ${rules.length} rules\n`);
  
  // Categorize rules
  console.log('📝 Categorizing and generating files...');
  const categories = {};
  let duplicates = 0;
  const seen = new Set();
  
  rules.forEach(({ selector, rule }) => {
    const normalized = rule.replace(/\s+/g, ' ').trim();
    if (seen.has(normalized)) {
      duplicates++;
      return;
    }
    seen.add(normalized);
    
    const category = categorizeRule(selector, rule);
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(rule);
  });
  
  if (duplicates > 0) {
    console.log(`   ⚠️  Removed ${duplicates} duplicate rules\n`);
  }
  
  // Generate files
  let totalSize = 0;
  let fileCount = 0;
  
  // Create directories
  const dirs = new Set();
  Object.keys(categories).forEach(file => {
    const dir = path.join(OUTPUT_BASE, path.dirname(file));
    dirs.add(dir);
  });
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Write files
  Object.entries(categories).forEach(([filepath, rules]) => {
    const fullPath = path.join(OUTPUT_BASE, filepath);
    const content = rules.join('\n\n') + '\n';
    fs.writeFileSync(fullPath, content);
    
    totalSize += content.length;
    fileCount++;
    console.log(`   ✅ ${filepath} (${content.length.toLocaleString()} bytes)`);
  });
  
  // Generate main index.css with imports
  console.log('\n📋 Generating main index.css...');
  
  const imports = [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    ''
  ];
  
  const sections = {};
  Object.keys(categories).forEach(file => {
    const section = file.split('/')[0];
    if (!sections[section]) sections[section] = [];
    sections[section].push(file);
  });
  
  ['base', 'components', 'pages', 'utils'].forEach(section => {
    if (sections[section]) {
      imports.push(`/* ${section.toUpperCase()} STYLES */`);
      sections[section].sort().forEach(file => {
        imports.push(`@import './${file}';`);
      });
      imports.push('');
    }
  });
  
  const indexContent = imports.join('\n');
  const indexPath = path.join(OUTPUT_BASE, 'index.css');
  fs.writeFileSync(indexPath, indexContent);
  
  totalSize += indexContent.length;
  fileCount++;
  console.log(`   ✅ index.css (${indexContent.length.toLocaleString()} bytes)`);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Original CSS:        ${originalSize.toLocaleString()} bytes`);
  console.log(`New total:           ${totalSize.toLocaleString()} bytes`);
  console.log(`Files created:       ${fileCount}`);
  
  const ratio = ((originalSize - totalSize) / originalSize * 100).toFixed(1);
  if (ratio > 0) {
    console.log(`Compression:         ${ratio}% better`);
  }
  
  console.log('\n✅ SETUP COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n🚀 Next steps:');
  console.log('   1. npm run build');
  console.log('   2. npm run dev');
  console.log('   3. Test in browser at http://localhost:5173\n');
  console.log('✨ Your CSS is now organized and maintainable!\n');
}

main();
