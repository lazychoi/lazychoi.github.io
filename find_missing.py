import os
import json

data_dir = "/Users/jun/Documents/lazychoi.github.io/data"
manifest_path = os.path.join(data_dir, "manifest.json")

with open(manifest_path, "r", encoding="utf-8") as f:
    files = json.load(f)

missing_entries = []
total_single_char_entries = 0

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
        
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        parts = line.strip().split("|")
        if len(parts) >= 2:
            hangul = parts[0]
            hanja = parts[1]
            # We only care about single characters
            if len(hangul) == 1 and len(hanja) == 1:
                total_single_char_entries += 1
                meaning = parts[2] if len(parts) > 2 else ""
                if not meaning.strip():
                    missing_entries.append({
                        "file": file,
                        "line_idx": idx,
                        "hangul": hangul,
                        "hanja": hanja,
                        "raw_line": line
                    })

print(f"Total single-char Hanja entries: {total_single_char_entries}")
print(f"Missing meaning entries: {len(missing_entries)}")
if missing_entries:
    print("Example missing entries (first 10):")
    for item in missing_entries[:10]:
        print(f"  {item['file']}:{item['line_idx']+1} -> {item['hangul']}|{item['hanja']}|")
