---
title: json 데이터 크롤링
date: 2022-10-13
---

## json 데이터 크롤링한 후 dict 형식으로 변환

교보문고 베스트셀러 데이터 크롤링(최대 100위까지)

순위, 제목, 저자, 할인가

```python
import json
import requests

# url 구조 파악
# 크롬 개발자 도구 >>> networks >>> Fetch/XHR 에서 찾음
json_url = "https://product.kyobobook.co.kr/api/gw/pub/pdt/best-seller/online?page=1&per=100&period=001&dsplDvsnCode=000&dsplTrgtDvsnCode=001"

res = requests.get(json_url)

json_dict = json.loads(res.text)
best_dict = json_dict['data']['bestSeller']

rank = []
title = []
author = []
sale_price = []
for item in best_dict:
    rank.append(item['prstRnkn'])
    title.append(item['cmdtName'])
    author.append(item['chrcName'])
    sale_price.append(item['sapr'])
for book in zip(rank, title, author, sale_price):
    print(book)
```
