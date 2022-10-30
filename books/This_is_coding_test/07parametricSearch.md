---
title: 07장 Parametric Search p202
date: 2022-10-18
---

- 원하는 조건을 만족하는 가장 알맞은 값을 찾는 문제
- 보통 이진 탐색을 이용해 해결

## 떡볶이 떡 만들기 p201

```python
# 교재 설명 읽고 짠 코드

n, m = 4, 6
array = [19,15,10,17]

start = 0
end = max(array)

def remainder(array, mid):
    result = []
    for i in array:
        if i > mid:
            result.append(i - mid)
    return sum(result)

def bi_search(array, m, start, end):
    while start <= end:
        mid = (start + end) // 2
        if remainder(array, mid) == m:
            return mid
        elif remainder(array, mid) > m:
            start = mid + 1
        else:
            end = mid - 1
        
print(bi_search(array, m, start, end))
# 15
```

```python
# 교재 코드

# 떡의 개수(n)와 요청한 떡의 길이(m) 입력받기
n, m = list(map(int, input().split()))
# 각 떡의 개별 높이 정보 입력받기
array = list(map(int, input().split()))

# 이진 탐색 위한 시작점, 끝점 설정
start = 0
end = max(array)

# 이진 탐색 수행
result = 0
while(start <= end):
    total = 0
    mid = (start + end) // 2
    for x in array:
        # 잘랐을 때의 양 계산
        if x > mid:
            total += x - mid
    # 떡의 양이 부족한 경우 더 많이 자르기(왼쪽 부분 탐색)
    if total < m:
        end = mid - 1
    # 떡의 양이 충분한 경우 덜 자르기(오른쪽 부분 탐색)
    else:
        result = mid # 최대한 덜 잘랐을 때가 정답이므로 여기에서 result 기록
        start = mid + 1
        
print(result)
#    4 6
#    19 15 10 17
#    15
```
