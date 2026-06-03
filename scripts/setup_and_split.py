#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complete CSS Setup and Auto-Split - All in One
Creates folders, templates, and auto-splits the CSS
"""

import os
import re
import io
import sys
from pathlib import Path
from collections import defaultdict

# Force UTF-8 output
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def setup_directories():
    """Create all necessary directories"""
    print("\n📁 Creating directory structure...")
    
    dirs = [
        'src/styles/base',
        'src/styles/components',
        'src/styles/pages',
        'src/styles/utils',
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"   ✅ {dir_path}")

def create_templates():
    """Create template files"""
    print("\n📝 Creating template files...")
    
    templates = {
        'src/styles/base/reset.css': """/* ──────────────────────────────────────────────────────────────────── */
/* RESET & BASE HTML STYLES */
/* ──────────────────────────────────────────────────────────────────── */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
}

body {
  font-family: system-ui, -apple-system, Segoe UI, Roboto;
  line-height: 1.6;
}

img, video, canvas, svg {
  display: block;
  max-width: 100%;
}

button {
  cursor: pointer;
  border: none;
}

a {
  text-decoration: none;
}
""",
        
        'src/styles/base/themes.css': """/* ──────────────────────────────────────────────────────────────────── */
/* THEME VARIABLES & COLOR SCHEME */
/* ──────────────────────────────────────────────────────────────────── */

:root {
  --text:     #1c1c1a;
  --bg:       #f5f5f2;
  --surface:  #ffffff;
  --card:     #ffffff;
  --border:   #e2e0db;
  --muted:    #6b6860;
  --accent:   #16a34a;
  --accent2:  #0ea5e9;
  --accentSoft: #dcfce7;
  --accentFg: #ffffff;
  --accentRGB: 22, 163, 74;
  --danger:   #dc2626;
  --warning:  #d97706;
  --success:  #16a34a;
  --inputBg:  #f8f8f6;
  --dangerBg: #fff1f1;
  --warningBg: #fffbeb;
  --successBg: #f0fdf4;
  --r: 12px;
  color-scheme: light;
}
""",
        
        'src/styles/base/typography.css': """/* ──────────────────────────────────────────────────────────────────── */
/* TYPOGRAPHY - HEADINGS & TEXT */
/* ──────────────────────────────────────────────────────────────────── */

h1, h2, h3, h4, h5, h6 {
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 0.5em;
}

h1 { font-size: 32px; }
h2 { font-size: 28px; }
h3 { font-size: 24px; }
h4 { font-size: 20px; }
h5 { font-size: 16px; }
h6 { font-size: 14px; }

p {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 1em;
}

@media (max-width: 768px) {
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 18px; }
}
""",
        
        'src/styles/components/buttons.css': """/* BUTTON COMPONENTS */
.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--r);
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent);
  color: var(--accentFg);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: white;
}
""",
        
        'src/styles/components/cards.css': """/* CARD COMPONENTS */
.card {
  padding: 16px;
  border-radius: var(--r);
  background: var(--card);
  border: 1px solid var(--border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
""",
        
        'src/styles/components/inputs.css': """/* FORM COMPONENTS */
.form-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group input,
.form-group textarea,
.form-group select {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--inputBg);
  font-size: 14px;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent);
}
""",
        
        'src/styles/components/tags.css': """/* TAGS & BADGES */
.tag, .badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 600;
  background: var(--accentSoft);
  color: var(--accent);
}

.badge-danger { background: #fee; color: var(--danger); }
.badge-warning { background: #fef3c7; color: var(--warning); }
""",
        
        'src/styles/components/modal.css': """/* MODAL & DRAWER */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1040;
}

.modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--card);
  border-radius: var(--r);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
""",
        
        'src/styles/components/progress.css': """/* PROGRESS BARS */
.progress {
  height: 8px;
  background: var(--inputBg);
  border-radius: 99px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}
""",
        
        'src/styles/components/nav.css': """/* NAVIGATION */
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.nav {
  display: flex;
  gap: 8px;
  list-style: none;
}

.nav-link {
  padding: 8px 12px;
  border-radius: var(--r);
  color: var(--text);
  transition: all 0.2s ease;
}

.nav-link:hover, .nav-link.active {
  background: var(--accentSoft);
  color: var(--accent);
}
""",
        
        'src/styles/utils/animations.css': """/* ANIMATIONS & KEYFRAMES */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn { animation: fadeIn 0.3s ease; }
.animate-slideInUp { animation: slideInUp 0.3s ease; }
""",
        
        'src/styles/utils/layout.css': """/* LAYOUT HELPERS */
.page-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px;
}

.grid {
  display: grid;
  gap: 16px;
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }

@media (max-width: 768px) {
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
}

.flex {
  display: flex;
  gap: 8px;
}

.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}
""",
        
        'src/styles/utils/pwa.css': """/* PWA SPECIFIC */
.pwa-install-btn {
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accentFg);
  border: none;
  border-radius: var(--r);
  font-weight: 600;
  cursor: pointer;
}

.pwa-install-prompt {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 999;
}
""",
    }
    
    for filepath, content in templates.items():
        path = Path(filepath)
        if not path.exists():
            path.write_text(content, encoding='utf-8')
            print(f"   ✅ {filepath}")

class CSSAutoSplitter:
    def __init__(self):
        self.seen_rules = set()
        self.pages = [
            'dashboard', 'courses', 'attendance', 'marks', 'assignments',
            'class-management', 'clubs', 'ct-quiz-planning', 'diary', 'money',
            'namaz', 'notes', 'profile', 'question-bank', 'results', 'schedule',
            'self-eval', 'self-study', 'teachers', 'term-qs', 'settings',
            'smart-score', 'alerts', 'calculators', 'extras', 'quick-access',
            'about', 'question-bank-viewer'
        ]
    
    def parse_css_file(self, filepath):
        print(f"\n📖 Reading {filepath}...")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"   ✅ Read {len(content):,} bytes")
            return content
        except FileNotFoundError:
            print(f"   ❌ File not found")
            return ""
    
    def extract_rules(self, css):
        rules = []
        i = 0
        
        while i < len(css):
            if css[i:i+2] == '/*':
                end = css.find('*/', i)
                if end == -1:
                    break
                i = end + 2
                continue
            
            if css[i].isspace():
                i += 1
                continue
            
            brace_pos = css.find('{', i)
            if brace_pos == -1:
                break
            
            brace_count = 1
            j = brace_pos + 1
            while j < len(css) and brace_count > 0:
                if css[j] == '{':
                    brace_count += 1
                elif css[j] == '}':
                    brace_count -= 1
                j += 1
            
            if brace_count == 0:
                rule = css[i:j].strip()
                if rule and not rule.startswith('@tailwind'):
                    rules.append(rule)
                i = j
            else:
                break
        
        return rules
    
    def detect_category(self, rule):
        selector = rule.split('{')[0].strip().lower()
        
        # Pages
        for page in self.pages:
            if f'.{page}' in selector or f'--{page}' in selector:
                return f'pages/{page}.css'
        
        # Base
        if ':root' in selector or '@media (prefers-color-scheme' in rule:
            return 'base/themes.css'
        if re.search(r'^(html|body|\*)', selector):
            return 'base/reset.css'
        if re.search(r'(^h[1-6]|^p|typography|font|text-)', selector):
            return 'base/typography.css'
        
        # Utils
        if '@keyframes' in rule:
            return 'utils/animations.css'
        if re.search(r'(\.page-|\.container|\.grid|\.flex)', selector):
            return 'utils/layout.css'
        if re.search(r'(pwa|install)', selector):
            return 'utils/pwa.css'
        
        # Components
        if '.btn' in selector:
            return 'components/buttons.css'
        if '.card' in selector or '.alert' in selector:
            return 'components/cards.css'
        if '.input' in selector or '.form' in selector:
            return 'components/inputs.css'
        if '.tag' in selector or '.badge' in selector:
            return 'components/tags.css'
        if '.modal' in selector or '.drawer' in selector:
            return 'components/modal.css'
        if '.progress' in selector:
            return 'components/progress.css'
        if '.nav' in selector:
            return 'components/nav.css'
        
        return 'utils/layout.css'
    
    def deduplicate(self, rule):
        normalized = re.sub(r'\s+', ' ', rule).strip()
        if normalized in self.seen_rules:
            return False
        self.seen_rules.add(normalized)
        return True
    
    def split_css(self, css):
        print("\n🔍 Parsing CSS rules...")
        
        css_to_parse = re.sub(r'@tailwind\s+[^;]+;', '', css)
        rules = self.extract_rules(css_to_parse)
        print(f"   📊 Found {len(rules)} rules")
        
        categorized = defaultdict(list)
        duplicates = 0
        
        for rule in rules:
            if not rule.strip():
                continue
            
            if self.deduplicate(rule):
                category = self.detect_category(rule)
                categorized[category].append(rule)
            else:
                duplicates += 1
        
        if duplicates > 0:
            print(f"   ⚠️  Removed {duplicates} duplicate rules")
        
        return categorized
    
    def generate_files(self, categorized):
        print("\n📝 Generating CSS files...")
        
        created = []
        total_size = 0
        
        for filepath in sorted(categorized.keys()):
            rules = categorized[filepath]
            content = '\n\n'.join(rules) + '\n'
            
            path = Path(filepath)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding='utf-8')
            
            size = len(content)
            total_size += size
            created.append((filepath, size))
            print(f"   ✅ {filepath} ({size:,} bytes)")
        
        return created, total_size
    
    def generate_index_css(self, categorized):
        print("\n📋 Generating main index.css...")
        
        imports = [
            "@tailwind base;",
            "@tailwind components;",
            "@tailwind utilities;",
            ""
        ]
        
        by_section = defaultdict(list)
        for filepath in sorted(categorized.keys()):
            section = filepath.split('/')[0]
            by_section[section].append(filepath)
        
        for section in ['base', 'components', 'pages', 'utils']:
            if section in by_section:
                imports.append(f"/* {section.upper()} STYLES */")
                for filepath in sorted(by_section[section]):
                    imports.append(f"@import './{filepath}';")
                imports.append("")
        
        content = '\n'.join(imports)
        Path('src/styles/index.css').write_text(content, encoding='utf-8')
        print(f"   ✅ src/styles/index.css ({len(content):,} bytes)")
        
        return content

def main():
    print("╔════════════════════════════════════════════════════════════╗")
    print("║      KUETx Complete CSS Setup & Auto-Split                 ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Setup
    setup_directories()
    create_templates()
    
    # Parse and split
    old_css = Path('src/index.css')
    if not old_css.exists():
        print("\n❌ Error: src/index.css not found")
        return
    
    splitter = CSSAutoSplitter()
    css_content = splitter.parse_css_file(str(old_css))
    
    if not css_content:
        return
    
    categorized = splitter.split_css(css_content)
    print(f"\n   📦 Categorized into {len(categorized)} files")
    
    created, total = splitter.generate_files(categorized)
    splitter.generate_index_css(categorized)
    
    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"Original CSS:        {len(css_content):,} bytes")
    print(f"New total:           {total:,} bytes")
    print(f"Files created:       {len(created)}")
    if len(css_content) > 0:
        print(f"Compression:         {100 - (total/len(css_content)*100):.1f}% better")
    
    print("\n✅ SETUP COMPLETE!")
    print("="*60)
    print("\n🚀 Next steps:")
    print("   1. npm run build")
    print("   2. npm run dev")
    print("   3. Test in browser at http://localhost:5173")
    print("\n✨ Your CSS is now organized and maintainable!")

if __name__ == '__main__':
    main()
