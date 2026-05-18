import re

with open('src/pages/Attendance.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Direct line-by-line fixes
for i, line in enumerate(lines):
    # Line 302: Friday emoji
    if 'Friday' in line and 'Jumu' in line:
        lines[i] = line.replace('Ã°Å¸â€¢Å'', '☕').replace('Ã°Å¸•Å'', '☕')
    
    # Line 351: Mark button
    if 'Mark</div>' in line and 'accent' in line:
        lines[i] = re.sub(r'Ã¢Å"â€œ|Ã¢Å\\"â€œ|Ã¢[^ ]*', '✅', line)
    
    # Line 424: slot join  
    if 'todayItems.map' in line and 'join' in line:
        lines[i] = line.replace("' Ã¢â€ â€™ '", "' • '").replace("' Ã¢[^ ]* '", "' • '")
    
    # Line 429: Marked badge
    if 'Marked' in line and 'Marked</div>' in line:
        lines[i] = re.sub(r'Ã¢Å"â€œ', '✅', line)
    
    # Line 456: Status display
    if 'statusLabels[status]' in line and 'Ã¢' in line:
        lines[i] = re.sub(r'Ã¢Å"â€œ', '✅', line)
    
    # Lines 465-466: Emoji in array
    if 'emoji:' in line and ('present' in line or 'absent' in line):
        lines[i] = line.replace("'Ã¢Å\"â€œ'", "'✅'").replace("'Ã¢Å\"â€"'", "'❌'")

with open('src/pages/Attendance.jsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('✓ Direct fixes applied')
