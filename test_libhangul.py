import urllib.request

url = "https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        count = 0
        for line in response:
            line_str = line.decode('utf-8').strip()
            if line_str.startswith("가:"):
                print(line_str)
                count += 1
                if count >= 30:
                    break
except Exception as e:
    print("Error:", e)
