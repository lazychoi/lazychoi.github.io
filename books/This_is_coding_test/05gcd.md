---
title: 05장 최대공약수 계산
date: 2022-10-14
---

[출처-나동빈 유튜브](https://youtu.be/7C9RgOcvkvo?list=PLRx0vPvlEmdAghTr5mXQxGpHjWqSz0dgC&t=1444){target=_blank}

수학 공식: 유클리드 호제법  

1. 두 자연수 A, B에 대해(A>B) A를 B로 나눈 나머지를 R이라고 할 때
2. A와 B의 최대공약수 = B와 R의 최대공약수

```python
def gcd(a, b):
    if a % b == 0:
        return b
    else:
        return gcd(b, a % b)

print(gcd(192, 162))
```
