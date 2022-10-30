---
title: 09장 Heap 자료 구조 
date: 2022-10-20
---

- 최댓값과 최솟값을 찾아내는 연산을 빠르게 하기 위해 고안된 완전이진트리(complete binary tree)를 기본으로 한 자료구조
- A가 B의 부모노드이면, A 키값과 B 키값 사이에는 대소관계가 성립한다.
- 최대 힙: 부모노드 키값 > 자식노드 키값
- 최소 힙: 부모노드 키값 < 자식노드 키값
- 형제 사이에는 대소관계가 정해지지 않는다.

## 파이썬 구현 p454

- heapq 라이브러리
- 최소 힙으로 구성
- heappush(), heappop()

## Heap Sort 힙 정렬

```python
# 오름차순

import heapq

def heapsort(iterable):
    h = []
    result = []
    for i in iterable:
        heapq.heappush(h, i)   # 모든 원소를 h 변수에 삽입
        print('push', h)
    for _ in range(len(h)):
        result.append(heapq.heappop(h)) # 힙에 삽입된 모든 변수를 차례대로 꺼내기
        print('pop', h)
    return result

print( heapsort([1, 3, 5, 7, 9, 2, 4, 6, 8]) )
```

```text
    push [1]
    push [1, 3]
    push [1, 3, 5]
    push [1, 3, 5, 7]
    push [1, 3, 5, 7, 9]
    push [1, 3, 2, 7, 9, 5]
    push [1, 3, 2, 7, 9, 5, 4]
    push [1, 3, 2, 6, 9, 5, 4, 7]
    push [1, 3, 2, 6, 9, 5, 4, 7, 8]
    pop [2, 3, 4, 6, 9, 5, 8, 7]
    pop [3, 6, 4, 7, 9, 5, 8]
    pop [4, 6, 5, 7, 9, 8]
    pop [5, 6, 8, 7, 9]
    pop [6, 7, 8, 9]
    pop [7, 9, 8]
    pop [8, 9]
    pop [9]
    pop []
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

## 최대 힙 구현

```python
# 내림차순

import heapq

def heapsort(iterable):
    h = []
    result = []
    for i in iterable:
        heapq.heappush(h, -i) # 부호를 바꾸어서 입력
    for _ in range(len(h)):
        result.append( -heapq.heappop(h) )  # 출력값의 부호를 바꾸어 부호 원상 복귀
    return result

print(heapsort([1, 3, 5, 7, 9, 2, 4, 6, 8]))        
#    [9, 8, 7, 6, 5, 4, 3, 2, 1]
```
