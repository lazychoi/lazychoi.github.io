import os
import json

data_dir = "/Users/jun/Documents/lazychoi.github.io/data"
manifest_path = os.path.join(data_dir, "manifest.json")

with open(manifest_path, "r", encoding="utf-8") as f:
    files = json.load(f)

single_chars = {}

for file in files:
    file_path = os.path.join(data_dir, file)
    if not os.path.exists(file_path):
        continue
    with open(file_path, "rb") as f:
        buf = f.read()
    if len(buf) >= 2 and buf[0] == 0xff and buf[1] == 0xfe:
        text = buf.decode("utf-16le")
    else:
        text = buf.decode("utf-8", errors="ignore")
    for idx, line in enumerate(text.splitlines()):
        parts = line.strip().split("|")
        if len(parts) >= 2:
            hangul = parts[0]
            hanja = parts[1]
            if len(hangul) == 1 and len(hanja) == 1:
                meaning = parts[2] if len(parts) > 2 else ""
                key = (hangul, hanja)
                if key not in single_chars:
                    single_chars[key] = []
                single_chars[key].append((file, idx+1, meaning))

print(f"Total unique (Hangul, Hanja) pairs of single characters: {len(single_chars)}")

# Count empty vs non-empty
empty_count = 0
non_empty_count = 0
for key, occurrences in single_chars.items():
    # If any occurrence has meaning, is it non-empty?
    has_meaning = any(occ[2].strip() for occ in occurrences)
    if has_meaning:
        non_empty_count += 1
    else:
        empty_count += 1

print(f"Unique pairs with some meaning: {non_empty_count}")
print(f"Unique pairs with NO meaning: {empty_count}")

# Print some examples where they appear multiple times or have different meanings
multiple_occ = {k: v for k, v in single_chars.items() if len(v) > 1}
print(f"Pairs appearing multiple times in the files: {len(multiple_occ)}")
for k, v in list(multiple_occ.items())[:5]:
    print(f"  {k} -> {v}")
