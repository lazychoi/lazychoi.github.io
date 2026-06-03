import urllib.request

url = "https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        for line in response:
            line_str = line.decode('utf-8').strip()
            if line_str.startswith("학:學"):
                print(line_str)
except Exception as e:
    print("Error:", e)
