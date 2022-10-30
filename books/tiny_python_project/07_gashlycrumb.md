---
title: 07장 특정 단어로 시작하는 텍스트 출력
date: 2022-10-18
---

## 배운 것

- 텍스트 문서의 맨 앞 4줄만 출력: `head -4 문서.txt`
- 인수로 입력한 파일이 존재하지 않으면 오류 메시지 출력하며 처리 중단: `type=argparse.FileType('rt')`

## 코드

```python
import datetime
h, m, s = map(int, input().split())
p = int(input())
start = datetime.datetime(100, 1, 1, h, m, s)
end = start + datetime.timedelta(seconds=p)
print(end.strftime("%-H %-M %-S"))
```
