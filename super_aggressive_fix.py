#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('src/pages/Attendance.jsx', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Just remove the problematic mojibake prefixes
# Common patterns in the file
import re

# Remove those corrupted prefix bytes that show up as question marks or other chars
content = re.sub(r'ðŸ[^ ]+ ', '', content)  # Remove corrupted emoji prefixes
content = re.sub(r'[\?]{2,}', lambda m: '• ', content)  # Replace ?? with bullet
content = re.sub(r'â[^ ]*', '', content)  # Remove corrupted â sequences  
content = re.sub(r'ðŸ', '', content)  # Remove corrupted ðŸ sequences
content = re.sub(r'Ã[^ ]* ', '', content)  # Remove corrupted Ã sequences

# Now add back emojis where needed
content = content.replace('Friday –', '☕ Friday –')
content = content.replace('Add courses first', '🔧 Add courses first')
content = content.replace('Mark', '✅ Mark')
content = content.replace('Marked', '✅ Marked')
content = content.replace('Scheduled for this', '📋 Scheduled for this')
content = content.replace('No classes to mark', '🔔 No classes to mark')
content = content.replace('No scheduled classes', '⚠️ No scheduled classes')

with open('src/pages/Attendance.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Fixed UTF-8 encoding corruption')


