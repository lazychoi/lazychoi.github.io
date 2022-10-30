---
title: 06장 정렬 실전 문제
date: 2022-10-17
---

## 위에서 아래로 p178

```python
n = int(input())
per = []
for _ in range(n):
    per.append(int(input()))

for i in sorted(per, reverse=True):
    print(i, end=' ')
```

```bash
    3
    15
    27
    12
    27 15 12 
```

## 성적이 낮은 순서로 학생 출력하기 p180

- 리스트 내 리스트의 두 번째 변수 기준으로 오름차순 정렬

==기억할 것== : sorted(리스트, **key= 정렬기준 지정 함수**)


```python
n = int(input())
array = []
for _ in range(n):
    name, score = input().split()
    array.append((name, int(score)))

def sort_key(data):
    return data[1]
    
sorted_scores = sorted(array, key = sort_key)

for stu in sorted_scores:
    print(stu[0], end=' ')
```

```bash
    3
    홍길동 80
    이순신 70
    김구 90
    이순신 홍길동 김구 
```

```python
# 함수를 별도로 만들지 않고 람다함수 이용

n = int(input())

array = []
for i in range(n):
    input_data = input().split()
    array.append( (input_data[0], int(input_data[1])))
    
array = sorted(array, key=lambda student:student[1])

for student in array:
    print(student[0], end=' ')
```

```bash
    3
    홍길도 60
    이순신 75
    김구 90
    홍길도 이순신 김구 
```

## 두 배열의 원소 교체 p182

```python
# k 번만큼 A의 가장 작은 숫자와 B의 가장 큰 숫자를 교환

n, k = map(int, input().split())
a = [ int(i) for i in input() ]
b = [ int(i) for i in input() ]

a, b = sorted(a), sorted(b, reverse=True)

for i in range(k):
    a[i], b[i] = b[i], a[i]       # <- a[i] 가 a[i] 보다 큰 경우를 생각하지 못함.
    
sum(a)
```

```bash
    5 3
    12543
    55665

    26
```

```python
# 교재 코드

n, k = map(int, input().split())
a = list(map(int, input().split()))
b = list(map(int, input().split()))

a.sort()
b.sort(reverse=True)

for i in range(k):
    # A의 원소가 B의 원소보다 작은 경우
    if a[i] < b[i]:
        a[i], b[i] = b[i], a[i]
    else:
        break

print(sum(a))
```

```bash
    5 3
    1 2 5 4 3
    5 5 6 6 5
    26
```
