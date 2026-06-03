#!/usr/bin/env python3
"""
CSS Page Style Extractor - Automated tool to extract page-specific styles
from the monolithic index.css file into individual page CSS files.

Usage:
    python scripts/extract_page_css.py Dashboard Courses Attendance
    
    This will create:
    - src/styles/pages/Dashboard.css
    - src/styles/pages/Courses.css
    - src/styles/pages/Attendance.css
"""

import re
import sys
from pathlib import Path

def to_kebab_case(name):
    """Convert CamelCase to kebab-case: Dashboard -> dashboard, DashboardPage -> dashboard-page"""
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1-\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1-\2', s1).lower()

def extract_page_styles(source_css, page_name):
    """
    Extract all CSS rules related to a specific page.
    
    Searches for:
    1. .page-name-* (e.g., .dashboard-grid, .dashboard-card)
    2. .pageName* (e.g., .dashboardGrid)
    3. Page-specific @media queries and keyframes
    """
    
    kebab_name = to_kebab_case(page_name)
    camel_name = page_name[0].lower() + page_name[1:]
    
    styles = []
    
    # Extract blocks with proper nesting (handles nested selectors)
    # Pattern: selector { ... } (even with nested blocks)
    bracket_pattern = r'[^{}]*(?:{[^{}]*(?:{[^{}]*}[^{}]*)*})?'
    
    for match in re.finditer(bracket_pattern + r'(?:\s*{[^}]*})?', source_css):
        block = match.group(0).strip()
        
        if not block or block.count('{') == 0:
            continue
        
        selector_part = block.split('{')[0].strip()
        
        # Check if selector matches page name (kebab or camel case)
        if (f'.{kebab_name}' in selector_part or 
            f'.{camel_name}' in selector_part or
            f'--{kebab_name}' in selector_part):  # CSS variables too
            
            styles.append(block)
    
    return '\n\n'.join(styles)

def extract_by_pattern(source_css, page_name):
    """
    Alternative extraction using a simpler line-by-line pattern matching.
    More reliable than regex for complex CSS.
    """
    
    kebab_name = to_kebab_case(page_name)
    camel_name = page_name[0].lower() + page_name[1:]
    
    lines = source_css.split('\n')
    result = []
    in_block = False
    brace_depth = 0
    current_rule = []
    
    for line in lines:
        # Check if this line contains the page name
        contains_page = (f'.{kebab_name}' in line or 
                        f'.{camel_name}' in line or
                        f'--{kebab_name}' in line or
                        f'/* {page_name}' in line)
        
        # Track brace depth for CSS blocks
        brace_depth += line.count('{')
        brace_depth -= line.count('}')
        
        if contains_page or in_block:
            current_rule.append(line)
            in_block = brace_depth > 0
            
            # End of block
            if brace_depth == 0 and in_block is False and current_rule:
                result.append('\n'.join(current_rule))
                current_rule = []
    
    return '\n\n'.join(result)

def create_page_css_files(index_css_path, output_dir, page_names):
    """Create individual CSS files for each page"""
    
    print(f"📖 Reading {index_css_path}...")
    with open(index_css_path, 'r', encoding='utf-8') as f:
        source_css = f.read()
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    created_files = []
    
    for page_name in page_names:
        print(f"\n🔍 Extracting styles for: {page_name}")
        
        # Extract styles
        page_styles = extract_by_pattern(source_css, page_name)
        
        if not page_styles.strip():
            print(f"   ⚠️  No styles found for {page_name}")
            continue
        
        # Create output file
        output_file = output_dir / f"{page_name}.css"
        
        # Add header comment
        header = f"""/* ──────────────────────────────────────────────────────────────────── */
/* {page_name.upper()} PAGE STYLES */
/* ──────────────────────────────────────────────────────────────────── */

"""
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(header)
            f.write(page_styles)
        
        file_size = len(page_styles)
        created_files.append((page_name, output_file, file_size))
        print(f"   ✅ Created: {output_file} ({file_size} bytes)")
    
    # Summary
    print(f"\n{'='*60}")
    print(f"📊 EXTRACTION SUMMARY")
    print(f"{'='*60}")
    
    total_size = sum(size for _, _, size in created_files)
    print(f"Total files created: {len(created_files)}")
    print(f"Total CSS extracted: {total_size} bytes")
    
    if total_size > 0:
        avg_size = total_size / len(created_files) if created_files else 0
        print(f"Average file size: {avg_size:.0f} bytes")
    
    for page_name, path, size in created_files:
        print(f"  • {page_name}: {size} bytes → {path.relative_to(Path.cwd())}")
    
    return created_files

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_page_css.py <PageName1> <PageName2> ...")
        print("\nExample:")
        print("  python extract_page_css.py Dashboard Courses Attendance Marks")
        print("\nThis will create:")
        print("  - src/styles/pages/Dashboard.css")
        print("  - src/styles/pages/Courses.css")
        print("  - src/styles/pages/Attendance.css")
        print("  - src/styles/pages/Marks.css")
        sys.exit(1)
    
    page_names = sys.argv[1:]
    index_css = Path('src/index.css')
    output_dir = Path('src/styles/pages')
    
    if not index_css.exists():
        print(f"❌ Error: {index_css} not found")
        sys.exit(1)
    
    create_page_css_files(index_css, output_dir, page_names)
    print("\n✨ Done! Review the extracted files and adjust as needed.")

if __name__ == '__main__':
    main()
