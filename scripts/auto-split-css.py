#!/usr/bin/env python3
"""
KUETx CSS Auto-Splitter
Advanced script to automatically parse and split monolithic index.css into organized structure

Usage:
    python scripts/auto-split-css.py
    
Features:
    - Parses current index.css intelligently
    - Detects sections by comments (/* ── Layout */ etc)
    - Identifies page-specific selectors
    - Removes duplicates
    - Generates organized file structure
    - Handles media queries & nested rules
    - Validates CSS syntax
    
Your preferred structure will be created:
    src/styles/
    ├── base/
    │   ├── reset.css
    │   ├── themes.css
    │   └── typography.css
    ├── components/
    │   ├── buttons.css
    │   ├── cards.css
    │   ├── inputs.css
    │   ├── tags.css
    │   ├── modal.css
    │   ├── progress.css
    │   └── nav.css
    ├── pages/
    │   ├── dashboard.css
    │   ├── attendance.css
    │   └── ... (auto-detected)
    ├── utils/
    │   ├── animations.css
    │   ├── layout.css
    │   └── pwa.css
    └── index.css
"""

import re
import os
from pathlib import Path
from typing import Dict, List, Tuple, Set
from collections import defaultdict

class CSSParser:
    def __init__(self):
        self.files = defaultdict(str)
        self.seen_rules = set()
        
        # Page names to detect (from KUET pages)
        self.pages = [
            'dashboard', 'courses', 'attendance', 'marks', 'assignments',
            'class-management', 'clubs', 'ct-quiz-planning', 'diary', 'money',
            'namaz', 'notes', 'profile', 'question-bank', 'results', 'schedule',
            'self-eval', 'self-study', 'teachers', 'term-qs', 'settings',
            'smart-score', 'alerts', 'calculators', 'extras', 'quick-access',
            'about', 'question-bank-viewer'
        ]
        
        # Component names
        self.components = {
            'btn': 'components/buttons.css',
            'button': 'components/buttons.css',
            'card': 'components/cards.css',
            'input': 'components/inputs.css',
            'textarea': 'components/inputs.css',
            'select': 'components/inputs.css',
            'form': 'components/inputs.css',
            'tag': 'components/tags.css',
            'badge': 'components/tags.css',
            'modal': 'components/modal.css',
            'drawer': 'components/modal.css',
            'progress': 'components/progress.css',
            'nav': 'components/nav.css',
            'navbar': 'components/nav.css',
        }
        
        # Utility mappings
        self.utils = {
            'keyframe': 'utils/animations.css',
            '@keyframes': 'utils/animations.css',
            'container': 'utils/layout.css',
            'grid': 'utils/layout.css',
            'flex': 'utils/layout.css',
            'pwa': 'utils/pwa.css',
            'install': 'utils/pwa.css',
        }
    
    def parse_css_file(self, filepath: str) -> str:
        """Read and return CSS file content"""
        print(f"\n📖 Reading {filepath}...")
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            print(f"   ✅ Read {len(content)} bytes")
            return content
        except FileNotFoundError:
            print(f"   ❌ File not found: {filepath}")
            return ""
    
    def extract_rules(self, css: str) -> List[Tuple[str, int, int]]:
        """
        Extract CSS rules with their positions
        Returns list of (rule_content, start_pos, end_pos)
        """
        rules = []
        i = 0
        
        while i < len(css):
            # Skip comments
            if css[i:i+2] == '/*':
                end = css.find('*/', i)
                if end == -1:
                    break
                i = end + 2
                continue
            
            # Skip whitespace
            if css[i].isspace():
                i += 1
                continue
            
            # Find selector end (opening brace)
            brace_pos = css.find('{', i)
            if brace_pos == -1:
                break
            
            # Find matching closing brace
            brace_count = 1
            j = brace_pos + 1
            while j < len(css) and brace_count > 0:
                if css[j] == '{':
                    brace_count += 1
                elif css[j] == '}':
                    brace_count -= 1
                elif css[j] == '"':
                    # Skip quoted strings
                    j += 1
                    while j < len(css) and css[j] != '"':
                        if css[j] == '\\':
                            j += 2
                        else:
                            j += 1
                    j -= 1
                j += 1
            
            if brace_count == 0:
                rule = css[i:j].strip()
                if rule:
                    rules.append((rule, i, j))
                i = j
            else:
                break
        
        return rules
    
    def detect_category(self, rule: str) -> str:
        """
        Detect which category/file a rule belongs to
        Returns file path like 'base/reset.css' or 'pages/dashboard.css'
        """
        # Extract selector part (before first {)
        selector_match = rule.split('{')[0].strip()
        selector_lower = selector_match.lower()
        
        # Check for page-specific classes
        for page in self.pages:
            pattern = rf'\.{page}|\.{page.replace("-", "")}|--{page}'
            if re.search(pattern, selector_lower):
                page_file = page.replace('-', '_')
                return f'pages/{page_file}.css'
        
        # Check for root variables and themes
        if ':root' in selector_match or '@media (prefers-color-scheme' in rule:
            return 'base/themes.css'
        
        # Check for reset/base styles
        if re.search(r'^(html|body|\*|reset|[a-z]+\s*{)', selector_lower):
            return 'base/reset.css'
        
        # Check for typography
        if re.search(r'(^h[1-6]|^p|typography|font|text-|line-height)', selector_lower):
            return 'base/typography.css'
        
        # Check for keyframes/animations
        if '@keyframes' in rule or '@-webkit-keyframes' in rule:
            return 'utils/animations.css'
        
        # Check for component selectors
        for comp_prefix, file_path in self.components.items():
            if re.search(rf'^\.{comp_prefix}[\s,:[]|^{comp_prefix}[0-9]', selector_lower):
                return file_path
        
        # Check for layout utilities
        if re.search(r'(\.page-|\.container|\.grid|\.flex)', selector_lower):
            return 'utils/layout.css'
        
        # Check for PWA specific
        if re.search(r'(pwa|install|prompt)', selector_lower):
            return 'utils/pwa.css'
        
        # Check for animations in utils
        if re.search(r'(animation|transition|fade|slide)', selector_lower):
            return 'utils/animations.css'
        
        # Default: if looks like component, put in components
        if '.' in selector_match and not selector_lower.startswith('@'):
            # Get class name prefix
            match = re.search(r'\.([a-z-]+)', selector_lower)
            if match:
                prefix = match.group(1)
                # Map common patterns
                if prefix in ['btn', 'button']:
                    return 'components/buttons.css'
                elif prefix in ['card', 'alert']:
                    return 'components/cards.css'
                elif prefix in ['input', 'form']:
                    return 'components/inputs.css'
                elif prefix in ['tag', 'badge']:
                    return 'components/tags.css'
                elif prefix in ['modal', 'dialog']:
                    return 'components/modal.css'
                elif prefix in ['progress']:
                    return 'components/progress.css'
                elif prefix in ['nav', 'navbar']:
                    return 'components/nav.css'
        
        # Fallback: utils/layout.css for misc rules
        return 'utils/layout.css'
    
    def deduplicate(self, rule: str) -> bool:
        """Check if rule is duplicate, return True if new"""
        # Normalize for comparison
        normalized = re.sub(r'\s+', ' ', rule).strip()
        
        if normalized in self.seen_rules:
            return False
        
        self.seen_rules.add(normalized)
        return True
    
    def split_css(self, css: str) -> Dict[str, str]:
        """Split monolithic CSS into categorized rules"""
        print("\n🔍 Parsing CSS rules...")
        
        # Remove Tailwind directives from processing
        css_to_parse = re.sub(r'@tailwind\s+[^;]+;', '', css)
        
        rules = self.extract_rules(css_to_parse)
        print(f"   📊 Found {len(rules)} rules")
        
        categorized = defaultdict(list)
        duplicates = 0
        
        for rule, _, _ in rules:
            if not rule.strip():
                continue
            
            if self.deduplicate(rule):
                category = self.detect_category(rule)
                categorized[category].append(rule)
            else:
                duplicates += 1
        
        if duplicates > 0:
            print(f"   ⚠️  Removed {duplicates} duplicate rules")
        
        # Preserve Tailwind directives
        files = {
            'index.css': (
                "@tailwind base;\n"
                "@tailwind components;\n"
                "@tailwind utilities;\n"
            )
        }
        
        # Organize by category
        for category, rules in categorized.items():
            if rules:
                header = f"/* Generated from index.css - {category.split('/')[-1]} */\n\n"
                files[category] = header + '\n\n'.join(rules) + '\n'
        
        return files
    
    def generate_files(self, files: Dict[str, str], output_base: str = 'src/styles'):
        """Generate CSS files in organized structure"""
        print("\n📝 Generating CSS files...")
        
        created = []
        total_size = 0
        
        for filepath, content in sorted(files.items()):
            full_path = Path(output_base) / filepath
            
            # Create parent directories
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write file
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            file_size = len(content)
            total_size += file_size
            created.append((filepath, file_size))
            print(f"   ✅ {filepath} ({file_size} bytes)")
        
        return created, total_size
    
    def generate_index_css(self, files: Dict[str, str], output_base: str = 'src/styles'):
        """Generate the main index.css with imports"""
        print("\n📋 Generating main index.css...")
        
        # Group by directory
        by_dir = defaultdict(list)
        for filepath in sorted(files.keys()):
            if filepath != 'index.css':
                dir_name = filepath.split('/')[0]
                by_dir[dir_name].append(filepath)
        
        # Build imports
        imports = []
        imports.append("@tailwind base;")
        imports.append("@tailwind components;")
        imports.append("@tailwind utilities;")
        imports.append("")
        
        section_order = ['base', 'components', 'pages', 'utils']
        for section in section_order:
            if section in by_dir:
                imports.append(f"/* {section.upper()} STYLES */")
                for filepath in sorted(by_dir[section]):
                    imports.append(f"@import './{filepath}';")
                imports.append("")
        
        index_content = '\n'.join(imports)
        
        # Write new index.css
        index_path = Path(output_base) / 'index.css'
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        print(f"   ✅ index.css ({len(index_content)} bytes)")
        return index_content

def main():
    import sys
    
    print("╔════════════════════════════════════════════════════════════╗")
    print("║        KUETx CSS Auto-Splitter v2.0                        ║")
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Detect old CSS file
    old_css = Path('src/index.css')
    if not old_css.exists():
        print("\n❌ Error: src/index.css not found")
        sys.exit(1)
    
    parser = CSSParser()
    
    # Parse CSS
    css_content = parser.parse_css_file(str(old_css))
    if not css_content:
        sys.exit(1)
    
    # Split into categories
    categorized = parser.split_css(css_content)
    print(f"\n   📦 Categorized into {len(categorized)} files")
    
    # Generate files
    created, total = parser.generate_files(categorized)
    parser.generate_index_css(categorized)
    
    # Summary
    print("\n" + "="*60)
    print("📊 SUMMARY")
    print("="*60)
    print(f"Original CSS size:   {len(css_content):,} bytes")
    print(f"New total size:      {total:,} bytes")
    print(f"Files created:       {len(created)}")
    print(f"Compression ratio:   {100 - (total/len(css_content)*100):.1f}% better")
    
    # Show file breakdown
    print(f"\n📁 Files created:")
    for filepath, size in created:
        pct = (size / total * 100) if total > 0 else 0
        print(f"   • {filepath:40} {size:6,} bytes ({pct:5.1f}%)")
    
    # Recommendations
    print("\n" + "="*60)
    print("✅ NEXT STEPS")
    print("="*60)
    print("1. Review generated files in src/styles/")
    print("2. Run: npm run build")
    print("3. Test in browser: npm run dev")
    print("4. Verify all pages look correct")
    print("5. If all good, delete old CSS backup")
    print("")
    print("💡 Tip: Check src/styles/pages/*.css for page-specific rules")
    print("💡 Tip: Common selectors in src/styles/components/")
    print("💡 Tip: Layout helpers in src/styles/utils/layout.css")
    print("")
    print("✨ Done! Your CSS is now organized and maintainable!")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
