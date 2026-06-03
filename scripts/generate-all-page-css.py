#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KUETx - Complete Page CSS Generator
Creates individual CSS files for all 28 pages with mobile/desktop optimization
"""

import os
from pathlib import Path

# All 28 pages
PAGES = [
    'About', 'Alerts', 'Assignments', 'Attendance', 'Calculators',
    'ClassManagement', 'Clubs', 'Courses', 'CTQuizPlanning', 'Dashboard',
    'Diary', 'Extras', 'Marks', 'Money', 'Namaz', 'Notes', 'Profile',
    'QuestionBank', 'QuestionBankViewer', 'QuickAccess', 'Results',
    'Schedule', 'SelfEval', 'SelfStudy', 'Settings', 'SmartScore',
    'Teachers', 'TermQS'
]

def get_page_class_name(page_name):
    """Convert PascalCase to kebab-case for CSS class"""
    result = []
    for i, char in enumerate(page_name):
        if char.isupper() and i > 0:
            result.append('-')
        result.append(char.lower())
    return ''.join(result)

def get_css_template(page_name):
    """Generate CSS template for a page with mobile-first responsive design"""
    class_name = get_page_class_name(page_name)
    
    return f"""/* ══════════════════════════════════════════════════════════════ */
/* {page_name.upper()} PAGE - Mobile-First Responsive Design */
/* ══════════════════════════════════════════════════════════════ */

.{class_name}-page {{
  position: relative;
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
}}

.{class_name}-page-header {{
  padding: 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}}

.{class_name}-page-header h1 {{
  font-size: 24px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}}

.{class_name}-page-header p {{
  font-size: 13px;
  color: var(--muted);
  margin: 4px 0 0 0;
}}

.{class_name}-page-content {{
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}}

.{class_name}-page-section {{
  display: flex;
  flex-direction: column;
  gap: 12px;
}}

.{class_name}-page-section-title {{
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  padding: 0 0 8px 0;
  border-bottom: 2px solid var(--accent);
}}

.{class_name}-page-card {{
  padding: 16px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}}

.{class_name}-page-card:hover {{
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: var(--accent);
}}

.{class_name}-page-button {{
  padding: 10px 16px;
  background: var(--accent);
  color: var(--accentFg);
  border: none;
  border-radius: var(--r);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}}

.{class_name}-page-button:hover {{
  filter: brightness(0.9);
  box-shadow: 0 4px 12px rgba(var(--accentRGB), 0.3);
}}

.{class_name}-page-input {{
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--r);
  background: var(--inputBg);
  color: var(--text);
  font-size: 14px;
  width: 100%;
}}

.{class_name}-page-input:focus {{
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accentRGB), 0.1);
}}

/* ── MOBILE OPTIMIZATIONS (< 640px) ── */
@media (max-width: 639px) {{
  .{class_name}-page-header {{
    padding: 12px;
  }}

  .{class_name}-page-header h1 {{
    font-size: 20px;
  }}

  .{class_name}-page-content {{
    padding: 12px;
    gap: 12px;
  }}

  .{class_name}-page-card {{
    padding: 12px;
  }}

  .{class_name}-page-button {{
    width: 100%;
    padding: 12px;
    font-size: 14px;
  }}
}}

/* ── TABLET OPTIMIZATIONS (640px - 1023px) ── */
@media (min-width: 640px) and (max-width: 1023px) {{
  .{class_name}-page-content {{
    padding: 20px;
  }}

  .{class_name}-page-section {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }}

  .{class_name}-page-card {{
    padding: 16px;
  }}
}}

/* ── DESKTOP OPTIMIZATIONS (>= 1024px) ── */
@media (min-width: 1024px) {{
  .{class_name}-page-content {{
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    gap: 24px;
  }}

  .{class_name}-page-section {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }}

  .{class_name}-page-card {{
    padding: 20px;
  }}

  .{class_name}-page-section:nth-child(even) {{
    grid-template-columns: repeat(2, 1fr);
  }}
}}

/* ── UTILITY CLASSES ── */
.{class_name}-page-full-width {{
  grid-column: 1 / -1;
}}

.{class_name}-page-half-width {{
  grid-column: span 1;
}}

.{class_name}-page-hidden-mobile {{
  display: none;
}}

@media (min-width: 640px) {{
  .{class_name}-page-hidden-mobile {{
    display: block;
  }}
}}

.{class_name}-page-hidden-desktop {{
  display: block;
}}

@media (min-width: 1024px) {{
  .{class_name}-page-hidden-desktop {{
    display: none;
  }}
}}
"""

def main():
    print('\n╔════════════════════════════════════════════════════════════╗')
    print('║     KUETx Complete Page CSS Generator (28 Pages)           ║')
    print('╚════════════════════════════════════════════════════════════╝\n')
    
    pages_dir = Path('src/styles/pages')
    pages_dir.mkdir(parents=True, exist_ok=True)
    
    print('📝 Generating CSS files for all 28 pages...\n')
    
    created = []
    for page_name in PAGES:
        class_name = get_page_class_name(page_name)
        css_file = pages_dir / f'{class_name}.css'
        
        # Skip if already exists
        if css_file.exists():
            print(f'   ⏭️  {css_file.name} (already exists)')
            continue
        
        content = get_css_template(page_name)
        css_file.write_text(content, encoding='utf-8')
        created.append((page_name, css_file.name, len(content)))
        print(f'   ✅ {css_file.name} ({len(content):,} bytes)')
    
    print(f'\n📊 Summary')
    print('═' * 60)
    print(f'Pages processed: {len(PAGES)}')
    print(f'CSS files created: {len(created)}')
    
    if created:
        total_size = sum(size for _, _, size in created)
        print(f'Total size: {total_size:,} bytes')
    
    print('\n✅ ALL PAGE CSS FILES CREATED!')
    print('═' * 60)
    print('\n🚀 Next: Update all page components to import their CSS files\n')

if __name__ == '__main__':
    main()
