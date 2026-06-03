import urllib.request
import os

url = "https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
        
    libhangul_dict = {}
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#") or not line:
            continue
        parts = line.split(":")
        if len(parts) >= 2:
            hangul = parts[0]
            hanja = parts[1]
            # meaning is parts[2] if exists
            meaning = parts[2] if len(parts) > 2 else ""
            if len(hangul) == 1 and len(hanja) == 1:
                key = (hangul, hanja)
                libhangul_dict[key] = meaning.strip()
                
    print(f"Total single-char entries in libhangul: {len(libhangul_dict)}")
    
    # Check how many are not empty
    non_empty = {k: v for k, v in libhangul_dict.items() if v}
    print(f"Non-empty entries in libhangul: {len(non_empty)}")
    
except Exception as e:
    print("Error:", e)
