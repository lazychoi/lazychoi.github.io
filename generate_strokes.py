import json
import os
import re

unihan_file = "/tmp/Unihan_IRGSources.txt"
output_file = "/Users/jun/Documents/lazychoi.github.io/data/strokes.json"

strokes = {}

with open(unihan_file, 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('#') or not line.strip():
            continue
        parts = line.strip().split('\t')
        if len(parts) >= 3:
            code = parts[0]
            prop = parts[1]
            value = parts[2]
            
            if prop == 'kTotalStrokes':
                # e.g., U+4E00
                try:
                    char_str = chr(int(code.replace('U+', ''), 16))
                    # some values have multiple strokes space separated e.g. "15 16", take the first one
                    stroke_count = int(value.split()[0])
                    strokes[char_str] = stroke_count
                except Exception as e:
                    pass

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(strokes, f, ensure_ascii=False, separators=(',', ':'))

print(f"Generated {output_file} with {len(strokes)} entries.")
