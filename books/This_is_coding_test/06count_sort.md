---
title: 06장 계수 정렬(Count Sort) 알고리즘
date: 2022-10-17
---

- 최악의 경우에도 O(N+K)를 보장. N=데이터 개수, K=최대값 크기
- 특정 조건에 부합할 때만 사용할 수 있지만 매우 빠름
- 일반적으로 가장 큰 데이터와 가장 작은 데이터의 차이가 1,000,000을 넘지 않을 때 효과적임
- 계수 정렬을 이용할 때는 '모든 범위를 담을 수 있는 크기의 리스트(배열)를 선언해야 함' 
- 선언할 리스트 크기는 모든 범위 + 1. 왜냐면 0부터 시작하기 때문

- 기존 리스트의 값을 새로운 리스트의 인덱스로 사용하여 +1 저장.
- 새로운 리스트의 인덱스를 이용해 정렬하기 때문에 저장과 동시에 자동 정렬됨

```python
# 모든 원소의 값이 0보다 크거나 같다고 가정
array = [7, 5, 9, 0, 3, 1, 6, 2, 9, 1, 4, 8, 0, 5, 2]

# 모든 범위를 포함하는 리스트 선언(모든 값은 0으로 초기화)
count = [0] * ( max(array) + 1 )

for i in range(len(array)):
    count[array[i]] += 1 # 각 데이터에 해당하는 인덱스의 값 증가
    
for i in range(len(count)):   # 새로운 리스트의 인덱스
    for j in range(count[i]): # 인덱스에 저장된 값 만큼 반복(같은 숫자가 여러 개일 경우)
        print(i, end=' ')     # 인덱스 출력
```

0 0 1 1 2 2 3 4 5 5 6 7 8 9 9

## 부품 찾기 p199

```python
# me

# n = int(input())
# n_list = list(map(int, input().split()))
              
# m = int(input())
# m_list = list(map(int, input().split()))

n = 5
n_list = [8,3,7,9,2]
m = 3
m_list = [5,7,9]

# n_list 계수정렬
result = [0] * ( max(n_list)+1 )
for i in n_list:
    result[i] += 1

sorted = []
for i in range(len(result)):
    if result[i] > 0:
        sorted.append(i)
print(sorted)

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
    temp = binary_search(sorted, target, 0, n-1)
    if temp == None:
        temp = 'no'
    print(temp, end=' ')
```

```text
[2, 3, 7, 8, 9]
no yes yes 
```

```python
# 교재

# 가게의 부품 개수 입력받기
n = int(input())
array = [0] * 1000001

# 가게에 있는 전체 부품 번호를 입력받아서 기록
for i in input().split():
    array[int(i)] = 1
    
# 손님이 요청한 부품 개수 입력받기
m = int(input())
# 손님이 확인 요청한 전체 부품 번호를 공백으로 구분하여 입력
x = list(map(int, input().split()))

# 손님이 확인 요청한 부품 번호를 하나씩 확인
for i in x:
    # 해당 부품이 존재하는지 확인
    if array[i] == 1:
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
