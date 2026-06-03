import urllib.request

url = "https://raw.githubusercontent.com/rycont/hanja-grade-dataset/master/hanja.csv"
# Try master first, then main if failed
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        for _ in range(20):
            line = response.readline()
            if not line:
                break
            print(line.decode('utf-8').strip())
except Exception as e:
    print("Master branch failed, trying main branch...")
    url_main = "https://raw.githubusercontent.com/rycont/hanja-grade-dataset/main/hanja.csv"
    try:
        req = urllib.request.Request(url_main, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            for _ in range(20):
                line = response.readline()
                if not line:
                    break
                print(line.decode('utf-8').strip())
    except Exception as e2:
        print("Error:", e2)
