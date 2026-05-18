#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# Read the file as bytes
with open('src/pages/Attendance.jsx', 'rb') as f:
    content = f.read()

# Define comprehensive replacement mappings using byte patterns
replacements = [
    # Corrupted UTF-8 bytes -> clean UTF-8 bytes
    # Multiple variants and partial replacements
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80', b'\xe2\x80\x93'),  # en-dash variant
    (b'\xc3\xa2\xc5\x92\xe2\x80\x9c', b'\xe2\x9c\x85'),  # check mark
    (b'\xc3\xa2\xc5\x92\xe2\x80\x9d', b'\xe2\x9d\x8c'),  # cross mark  
    (b'\xc3\xb0\xc5\xb8\xc2\xbd\xe2\x80\xb0', b'\xf0\x9f\x94\x94'),  # bell
    (b'\xc3\xb0\xc5\xb8\xe2\x80\xa2\xc5\x92', b'\xe2\x98\x95'),  # coffee
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xc5\xa1', b'\xf0\x9f\x94\xa7'),  # wrench
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xa6', b'\xe2\x9a\xa0\xef\xb8\x8f'),  # warning
    (b'\xc3\xb0\xc5\xb8\xe2\x80\x9c\xe2\x80\xb9', b'\xf0\x9f\x93\x8b'),  # clipboard
    (b'\xc3\xa2\xe2\x82\xac\xc2\xa2', b'\xe2\x80\xa2'),  # bullet
    (b'\xc3\x82\xc2\xb7', b'\xc2\xb7'),  # middle dot
    # Additional partial patterns
    (b'\xc3\xa2\xc5\x92\xe2\x80', b'\xe2\x9c'),  # partial check
    (b'\xc3\xa2\xe2\x80 \xe2\x80\x99', b'\xe2\x80\x99'),  # quote mark
    # Corrupted dashes
    (b'\xc3\xa2\xe2\x82\xac\xe2\x80\x93', b'\xe2\x80\x93'),  # another dash variant
    # Hex patterns that may not decode properly
    (b'\xc3\xa2\xc5\x92\xe2\x80\x9c', b'\xe2\x9c\x85'),  # checkmark
    (b'\xc3\xa2\xc5\x92\xe2\x80\x9d', b'\xe2\x9d\x8c'),  # cross mark
    (b'\xc2\xa9', b'\xc2\xa9'),  # copyright (keep as is)
]

# Apply replacements
for corrupted, clean in replacements:
    content = content.replace(corrupted, clean)

# Write back
with open('src/pages/Attendance.jsx', 'wb') as f:
    f.write(content)

print('✓ Fixed all UTF-8 encoding corruption')
