import os
import json

data_dir = "/Users/jun/Documents/lazychoi.github.io/data"
manifest_path = os.path.join(data_dir, "manifest.json")

with open(manifest_path, "r", encoding="utf-8") as f:
    files = json.load(f)

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
        if "賈" in line:
            print(f"{file}:{idx+1} -> {line.strip()}")
