---
title: 07장 이진 탐색(Binary Search) p188
date: 2022-10-18
---

- 배열 내부의 데이터가 정렬되어 있어야 사용 가능
- 탐색 범위를 절반씩 좁혀가며 탐색
- 시간 복잡도 O(NlogN)

```python
# 재귀 함수 이용 코드
# 찾는 값의 인덱스를 반환

def binary_search(array,target, start, end):
    if start > end:
        return None
    mid = ( start + end ) // 2
    if array[mid] == target:
        return mid
    elif array[mid] > target:
        return binary_search(array,target, start, mid - 1)
    else:
        return binary_search(array,target, mid + 1, end)
    
n, target = list(map(int, input().split()))
array = list(map(int, input().split()))

result = binary_search(array, target, 0, n-1)
if result == None:
    print('원소가 존재하지 않습니다.')
else:
    print(result + 1)
```

```text
    10 7
    1 2 3 4 5 6 7 8 9 10
    7
```

```python
# 반복문으로 구현

def binary_search(array, target, start, end):
    while start <= end:
        mid = (start + end) // 2
        if array[mid] == target:
             return mid
        # 찾는 값이 중앙값보다 작으면 중앙값-1을 끝 인덱스에 담아 왼쪽 확인
        elif array[mid] > target:
            end = mid - 1
        # 찾는 값이 중앙값보다 크면 중앙값+1을 시작 인덱스에 담아 오른쪽 확인
        else:
            start = mid + 1
    return None

n, target = list(map(int, input().split()))
array = list(map(int, input().split()))

result = binary_search(array, target, 0, n-1)
if result == None:
    print('찾는 숫자가 없습니다.')
else:
    print(result + 1)
```

```text
    10 7
    1 2 3 4 5 6 7 8 9 10
    7
```

## 부품 찾기 p197¶

```python
# 내가 짠 것

n = int(input())
n_list = list(map(int, input().split()))
              
m = int(input())
m_list = list(map(int, input().split()))
              
n_list.sort()

def binary_search(n_list, target, start, end):
    
    while start <= end:
        mid = (start + end) // 2
        if n_list[mid] == target:
            return 'yes'
        elif n_list[mid] < target:
            start = mid + 1
        else:
            end = mid - 1

for target in m_list:
    temp = binary_search(n_list, target, 0, n-1)
    if temp == None:
        temp = 'no'
    print(temp, end=' ')
```

```text
    5
    8 3 7 9 2
    3 
    5 7 9
    no yes yes 
```

```python
# 교재 코드

def binary_search(array, target, start, end):
    while start <= end:
        mid = (start + end) // 2
        if array[mid] == target:
            return mid
        elif array[mid] > target:
            end = mid -1
        else:
            start = mid + 1
            
n = int(input())
array = list(map(int, input().split()))
array.sort()

m = int(input())
x = list(map(int, input().split()))

for i in x:
    result = binary_search(array, i, 0, n - 1)
    if result != None:
        print('yes', end=' ')
    else:
        print('no', end=' ')
```

```text
    5
    8 3 7 9 2
    3
    5 7 9
    no yes yes 
```

## set 자료형 이용한 풀이

```python
n = int(input())
# 가게의 전체 부품 번호를 입력받아 집합 자료형에 기록
array = set(map(int, input().split()))

m = int(input())
x = list(map(int, input().split()))

for i in x:
    if i in array:
        print('yes', end=' ')
    else:
        print('no', end=' ')
```

```text
    5
    8 3 7 9 2
    3 
    5 7 9
    no yes yes 
```

## 강사가 소개한 책

- 케빈 머피, Machine Learning
- 토머스 코멘, introduction to Algorithms
