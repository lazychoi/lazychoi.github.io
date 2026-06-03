import os

file_path = "/Users/jun/Documents/lazychoi.github.io/data/h01ga.txt"
with open(file_path, "rb") as f:
    buf = f.read()

if len(buf) >= 2 and buf[0] == 0xff and buf[1] == 0xfe:
    text = buf.decode("utf-16le")
else:
    text = buf.decode("utf-8", errors="ignore")

for idx, line in enumerate(text.splitlines()):
    if line.startswith("개|解"):
        print(f"Line {idx+1}: {line.strip()}")
