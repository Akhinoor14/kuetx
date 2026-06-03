#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KUETx - Add CSS Imports to All Pages
Updates all 28 page JSX files to import their respective CSS
"""

import os
import re
from pathlib import Path

PAGES = [
    ('About', 'about'),
    ('Alerts', 'alerts'),
    ('Assignments', 'assignments'),
    ('Attendance', 'attendance'),
    ('Calculators', 'calculators'),
    ('ClassManagement', 'class-management'),
    ('Clubs', 'clubs'),
    ('Courses', 'courses'),
    ('CTQuizPlanning', 'c-t-quiz-planning'),
    ('Dashboard', 'dashboard'),
    ('Diary', 'diary'),
    ('Extras', 'extras'),
    ('Marks', 'marks'),
    ('Money', 'money'),
    ('Namaz', 'namaz'),
    ('Notes', 'notes'),
    ('Profile', 'profile'),
    ('QuestionBank', 'question-bank'),
    ('QuestionBankViewer', 'question-bank-viewer'),
    ('QuickAccess', 'quick-access'),
    ('Results', 'results'),
    ('Schedule', 'schedule'),
    ('SelfEval', 'self-eval'),
    ('SelfStudy', 'self-study'),
    ('Settings', 'settings'),
    ('SmartScore', 'smart-score'),
    ('Teachers', 'teachers'),
    ('TermQS', 'term-q-s'),
]

def add_css_import(jsx_file, css_name):
    """Add CSS import to JSX file if not already present"""
    import_statement = f"import '../styles/pages/{css_name}.css';"
    
    content = jsx_file.read_text(encoding='utf-8')
    
    # Check if import already exists
    if f"import '../styles/pages/" in content:
        return False, "Already has CSS import"
    
    # Find the last import statement
    lines = content.split('\n')
    last_import_idx = -1
    
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') or line.strip().startswith('export '):
            if line.strip().startswith('import '):
                last_import_idx = i
    
    if last_import_idx == -1:
        # No imports found, insert after file start
        lines.insert(0, import_statement)
    else:
        # Insert after last import
        lines.insert(last_import_idx + 1, import_statement)
    
    new_content = '\n'.join(lines)
    jsx_file.write_text(new_content, encoding='utf-8')
    return True, "Import added"

def main():
    print('\n╔════════════════════════════════════════════════════════════╗')
    print('║     KUETx - Add CSS Imports to All Pages (28)              ║')
    print('╚════════════════════════════════════════════════════════════╝\n')
    
    pages_dir = Path('src/pages')
    
    print('📝 Adding CSS imports to all page JSX files...\n')
    
    updated = []
    skipped = []
    
    for page_name, css_name in PAGES:
        jsx_file = pages_dir / f'{page_name}.jsx'
        
        if not jsx_file.exists():
            print(f'   ❌ {page_name}.jsx (not found)')
            continue
        
        try:
            success, msg = add_css_import(jsx_file, css_name)
            if success:
                updated.append((page_name, css_name))
                print(f'   ✅ {page_name}.jsx → {css_name}.css')
            else:
                skipped.append((page_name, msg))
                print(f'   ⏭️  {page_name}.jsx ({msg})')
        except Exception as e:
            print(f'   ⚠️  {page_name}.jsx (error: {str(e)[:40]})')
    
    print(f'\n📊 Summary')
    print('═' * 60)
    print(f'Pages updated: {len(updated)}')
    print(f'Pages skipped: {len(skipped)}')
    
    print('\n✅ CSS IMPORTS ADDED TO ALL PAGES!')
    print('═' * 60)
    print('\n🚀 Next: Run build to verify all imports work\n')

if __name__ == '__main__':
    main()
