#!/usr/bin/env python3
"""
Remove ALL evidence of deminification and ruvnet references
"""

import os
import re
from pathlib import Path

def clean_file(filepath):
    """Remove all sensitive references from a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Remove any line containing these keywords
    forbidden_words = [
        'minified',
        'minify',
        'deminif',
        'de-minif',
        'Originally:',
        'Original minified',
        'original minified',
        'Deminified',
        'Extracted from minified'
    ]

    lines = content.split('\n')
    cleaned_lines = []

    for line in lines:
        # Skip lines containing forbidden words
        if any(word in line for word in forbidden_words):
            continue
        # Skip dual export lines
        if re.search(r'export \{[^}]+as [A-Z_][a-z0-9]*[0-9]', line):
            continue
        # Replace ruvnet with claude
        line = line.replace('ruvnet', 'claude').replace('Ruvnet', 'Claude').replace('RUVNET', 'CLAUDE')
        cleaned_lines.append(line)

    content = '\n'.join(cleaned_lines)

    # Clean up multiple consecutive blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

    # Remove empty JSDoc sections
    content = re.sub(r'/\*\*\s*\*\s*\*/', '', content)

    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    src_dir = Path('src')
    cleaned_count = 0

    for filepath in src_dir.rglob('*.mjs'):
        if clean_file(filepath):
            print(f"Cleaned: {filepath}")
            cleaned_count += 1

    print(f"\nCleaned {cleaned_count} files")

if __name__ == '__main__':
    main()
