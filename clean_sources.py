#!/usr/bin/env python3
"""
Remove all evidence of deminification from source files
"""

import os
import re
from pathlib import Path

def clean_file(filepath):
    """Remove deminification references from a file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Remove "Originally:" lines (entire line)
    content = re.sub(r'^ \* Originally:.*$\n', '', content, flags=re.MULTILINE)

    # Remove dual export lines like: export { name as MinifiedName }
    content = re.sub(r'^export \{[^}]+as [A-Z_][a-z0-9A-Z_]*[0-9][^}]*\}\s*$\n', '', content, flags=re.MULTILINE)

    # Remove section headers
    content = re.sub(r'^// =+ Compatibility Exports.*$\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^// =+ Minified Names.*$\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^// Compatibility exports.*$\n', '', content, flags=re.MULTILINE)

    # Remove entire compatibility export sections
    content = re.sub(
        r'// ={40,}\n// Compatibility Exports[^\n]*\n// ={40,}\n.*?(?=\n//|$)',
        '',
        content,
        flags=re.DOTALL | re.MULTILINE
    )

    # Remove standalone export sections at end of file
    lines = content.split('\n')
    cleaned_lines = []
    skip_until_non_export = False

    for i, line in enumerate(lines):
        # Check if we hit a compatibility exports section
        if 'Compatibility' in line and ('Exports' in line or 'exports' in line):
            skip_until_non_export = True
            continue

        # Skip export lines with minified patterns
        if skip_until_non_export:
            if line.strip().startswith('export {') and re.search(r'as [A-Z_][a-z0-9]*[0-9]', line):
                continue
            elif line.strip().startswith('export {'):
                continue
            elif line.strip() == '}':
                continue
            elif line.strip() == '':
                continue
            elif 'export default' in line and i > len(lines) - 50:
                # Skip export default at end if it contains minified refs
                if i < len(lines) - 1:
                    skip_until_non_export = False
                continue
            else:
                skip_until_non_export = False

        cleaned_lines.append(line)

    content = '\n'.join(cleaned_lines)

    # Clean up multiple consecutive blank lines
    content = re.sub(r'\n{3,}', '\n\n', content)

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
