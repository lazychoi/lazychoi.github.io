---
title: 05장 스택 큐 재귀함수
date: 2022-10-14
---

## 요약

- 스택(Stack, 선입후출)과 큐(queue, 선입선출)는 자료구조의 기초 개념으로 삽입(push)과 삭제(pop) 두 핵심적인 함수로 구성됨.
- 파이썬에서 스택을 이용할 때는 append()와 pop() 메서드 사용함.
- 파이썬에서 큐를 이용할 때는 `from collections import deque` 라이브러리 사용함.
- 재귀함수는 종료 조건을 꼭 명시해야 함.

## deque 라이브러리

```python
from collections import deque

queue = deque()

queue.append(5)
queue.append(2)
queue.append(3)
queue.append(7)
queue.popleft()
queue.append(1)
queue.append(4)
queue.popleft()

print(queue)   # deque([3, 7, 1, 4])
```

deque 모듈은 속도가 빠르다. 코딩테스트는 대부분 기본 라이브러리 사용 허용

## 재귀함수

- 컴퓨터 내부에서 재귀 함수 수행은 스택 자료구조 이용. 마지막에 호출한 함수가 끝나야 그 앞의 함수 호출이 종료되기 때문.
- 따라서 스택 자료구조를 활용해야 하는 상당수 알고리즘은 재귀 함수를 이용해 구현 => ==DFS==

Factorial 구현 예제

```python
# 재귀함수 이용
def factorial_resursion(n):
    if n <= 1:
        print('1', end='')
        return 1
    print(n, '*', end=' ')
    return n * factorial_resursion(n-1)

print(' = ', factorial_resursion(5) ) # 5 * 4 * 3 * 2 * 1 =  120
```

위 print 출력 결과를 보면 작동 순서를 짐작할 수 있다. 함수 호출 역순으로 실행됨.

```python
# 반복문 이용

n = 5
result = 1

for i in range(1, n+1):
    print(i,' * ', result, end=' = ')
    result *= i
    print(result)

print(result)
# 1  *  1 = 1
# 2  *  1 = 2
# 3  *  2 = 6
# 4  *  6 = 24
# 5  *  24 = 120
# 120
```

## 오류

- **overflow** : 특정한 자료구조가 수용할 수 있는 데이터의 크기를 이미 가득 채운 상태에서 삽인 연산을 수행할 때 발생. #용어
- **underflow** : 특정한 자료구조에 데이터가 전혀 들어 있지 않은 상태에서 삭제 연산을 수행할 때 발생. #용어
