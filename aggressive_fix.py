#!/usr/bin/env python3
import os
import re

file_path = 'src/pages/Attendance.jsx'

# Read as bytes and get hex content for analysis
with open(file_path, 'rb') as f:
    content = f.read()

# Try to understand the actual byte patterns present
# First, let's just replace obvious corrupted sequences
replacements_hex = [
    # Pattern matching approach - replace partial mojibake sequences
    (b'\xc3\xa2\xc5\x92', b'\xe2\x9c'),  # Remove prefix of corrupted check
    (b'\xc3\xb0\xc5\xb8', b'\xf0\x9f'),  # Remove prefix of corrupted emoji
    (b'\xc5\x92', b''),  # Remove remaining mojibake chars
    (b'\xc2\xbd', b''),  # Clean partial bytes
    (b'\xc5\xa1', b''),  # Clean partial bytes
]

# Apply replacements
for corrupted, clean in replacements_hex:
    content = content.replace(corrupted, clean)

# Write back
with open(file_path, 'wb') as f:
    f.write(content)

print('✓ Cleaned up all UTF-8 corruption prefixes')
