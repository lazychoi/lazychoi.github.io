import urllib.request

url = "https://raw.githubusercontent.com/rutopio/Korean-Name-Hanja-Charset/master/data-naver.csv"
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        for _ in range(30):
            line = response.readline()
            if not line:
                break
            print(line.decode('utf-8').strip())
except Exception as e:
    print("Error:", e)
