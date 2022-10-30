---
title: 08장 Dynamic Programming(동적 계획법) p208
date: 2022-10-19
---

- 메모리 공간을 약간 더 사용하면 연산 속도를 비약적으로 증가시킬 수 있는 방법 중 하나
- 피보나치 수열 => 재귀함수를 사용하면 큰 수가 입력되면 시간 복잡도가 기하급수적으로 증가
- 메모이제이션(Memoization) 기법 = Caching : 한 번 구한 결과를 메모리 공간에 저장해두고 같은 식을 다시 호출하면 저장한 결과를 가져오는 기법
- meoization 구현 = 구한 정보를 리스트에 저장
- Top-Donw 방식 : 큰 문제 해결 위해 작은 문제 호출. **재귀함수** 이용
- Bottom-Up 방식 : 작은 문제부터 차근차근 답을 도출. **반복문** 이용

```python
# 피보나치 수열 => 아래 코드는 O(2^N) 시간 소요

import time 

def fibo(x):
    if x == 1 or x == 2:
        return 1
    return fibo(x - 1) + fibo(x - 2)

start = time.time()
print( fibo(40) )
end = time.time()

print(end - start)
#    102334155
#    19.516452312469482
```

```python
# 피보나치 수열 메모이제이션 구현(탑다운)

# 피보나치 수열로 계산할 숫자 + 1 => 0으로 시작하는 인덱스를 숫자와 매칭시키기 위해
import time

def fibo(x):
    if x == 1 or x == 2:
        return 1
    
    if d[x] != 0:
        return d[x]
    
    d[x] = fibo(x - 1) + fibo(x - 2)
    return d[x]

start = time.time()
print( fibo(40) )
end = time.time()

print(end - start)
#    102334155
#    0.0010139942169189453
```

```python
# 피보나치 수열 DP table(보텀업)

start = time.time()
d = [0] * 100
d[1] = 1
d[2] = 1
n = 40

for i in range(3, n+1):
    d[i] = d[i - 1] + d[i - 2]
end = time.time()
print(d[n])
print(end-start)
#    102334155
#    0.0001983642578125
```

## 1로 만들기 p217

답을 보고 유추한 풀이 과정

1. 계산 횟수가 0인 리스트를 만든다. 크기는 입력 허용 범위 + 1 (0인덱스 제외하여 숫자와 인덱스 일치시키기 위해)
2. 2부터 차례대로 1이 될 때까지의 계산횟수를 입력한다.
3. 기본 계산 횟수는 문제 조건에 따라 "숫자 - 1"의 계산횟수에 1을 더한 것이다. 1을 더하는 까닭은 자신을 계산한 횟수를 포함하기 위해서다.
4. 문제에서 제시된 수(2 or 3 or 5)로 나누어 떨어지면 "몫 + 1" 한 계산횟수와 "숫자 - 1"의 계산횟수를 비교하여 작은 것을 계산횟수로 입력한다.

=> 위 과정을 2부터 "계산할 수 + 1"까지 반복한다.

```python
x = 6

# 앞서 계산된 결과를 저장하기 위햔 DP table 초기화
# 문제에 제시된 입력범위 30000
# d 리스트에는 계산 횟수가 입력됨
d = [0] * 30001 


# 1이 나올 때까지 빼는 것이기 때문에 2부터 시작
for i in range(2, x+1):
    
    # 현재 수에서 1을 빼는 경우
    # 자신보다 1 작은 수의 계산횟수 + 자신을 호출한 횟수(1) 더하기
    d[i] = d[i - 1] + 1
    
    
    # 나누어 떨어지는 수가 없으면 자신의 인덱스를 그대로 추가하고,
    # 2로 나누어 떨어지면 몫에 해당하는 값에 횟수를 가리키는 +1 
    
    # 현재 수가 2로 나누어 떨어지는 경우
    if i % 2 == 0:
        d[i] = min(d[i], d[i // 2] + 1)

    # 현재 수가 3으로 나누어 떨어지는 경우
    if i % 3 == 0:
        d[i] = min(d[i], d[i // 3] + 1)
    
    # 현재 수가 5로 나누어 떨어지는 경우
    if i % 5 == 0:
        d[i] = min(d[i], d[i // 5] + 1)
        
print(d[x])
#    2
```

d 변수의 각 인덱스에 1로 만드는 최소한의 횟수가 저장됨 

```text
d1 = 0
d2 : d1 + 1 -> 1 -> 2로 나누어 떨어짐 min(d2, d1+1) -> (1, 1) -> 1
d3 : d2 + 1 -> 2 -> 3으로 나누어 떨어짐 min(d3, d1 + 1) -> (2, 1) -> 1
d4 : d3 + 1 -> 2 -> 2로 나누어 떨어짐 min(d4, d2 + 1) -> (2, 2) -> 2
d5 : d4 + 1 -> 3 -> 5로 나누어 떨어짐 min(d5, d1 + 1) -> (3, 1) -> 1
d6 : d5 + 1 -> 2 -> 2로 나누어 떨어짐 min(d6, d3 + 1) -> (2, 2) -> 2
                    3으로 나누어 떨어짐 min(d6, d2 + 1) -> (2, 2) -> 2
d7 : d6 + 1 -> 3
d8 : d7 + 1 -> 4 -> 2로 나누어 떨어짐 min(d8, d4 + 1) -> (4, 3) -> 3
d9 : d8 + 1 -> 4 -> 3으로 나누어 떨어짐 min(d9, d3 + 1) -> (4, 2) -> 2
```

## 개미 전사 p220

d <- 이전까지 숫자 합계 중 가장 큰 합계 저장

1. d[0] <- 변수의 초기값
2. d[1] <- d[0], d[1] 중 큰 값
3. d[n] <- d[n-1]과 d[n-2]+d[n] 중 큰 값 저장 왜냐면, -1 인덱스를 쓰거나(자신을 더할 수 없음) -2 인덱스를 써야하기(자신 더할 수 있음) 때문에

```python
# 내 코드 -> 틀림
# 입력 숫자 크기 +1의 리스트 변수 만들기
# 3부터 크기 만큼 반복
# 인덱스에 -2까지의 합계 저장


k = [1,3,1,5, 1, 1, 5]
n = len(k)

d = [0] * (n + 1)

for i in range(2, n):
    
    d[1] = k[0] + k[1]
    d[i] = k[i-2] + k[i]
    d[i] = max( d[i], d[i-1])
    
print(d[n-1])
#    8
```

```python
# 교재 코드

n = int(input())
# 모든 식량 정보 입력
array = list(map(int, input().split()))

# 앞서 계산된 결과를 저장하기 위한 DP 테이블 초기화
d = [0] * 100

d[0] = array[0]
d[1] = max(array[0], array[1])
for i in range(2, n):
    d[i] = max(d[i-1], d[i-2]+array[i])
    
print(d[n-1])
#    7
#    1 3 1 5 1 1 5
#    13
```

## 바닥 공사 P223

```python
# 못 품
n = int(input())

d = [0] * 1001
d[1] = 1  # 세로 1개
d[2] = 3  # 가로 2개, 세로 2개, 정방형 1개

for i in range(3, n+1):
    
    if i % 2 == 1:
        d[i] = d[i-1] + 1 # 홀수번째는 세로 1개 넣을 공간만 남음
    else:
        d[i] = d[i-2] + 3

print(d[n])
#    3
#    4
```

```python
# 교재 풀이

n = int(input())

d = [0] * 1001
d[1] = 1  # 세로 1개
d[2] = 3  # 가로 2개, 세로 2개, 정방형 1개

for i in range(3, n+1):
    d[i] = ( d[i-1] + 2 * d[i-2] ) % 796796 

print(d[n])
#    4
#    11
```

## 효율적인 화폐 구성 p226

```python
# 화폐 가치가 큰 것부터 정렬
# 3으로 나눈 나머지가 2로 나누어 떨어져야 함

n, m = map(int, input().split())
p = [ int(input()) for _ in range(n) ]

result = 0
p.sort(reverse=True)

for i in range(0, len(p)-1):
    a = (m % p[i])
    b = p[i+1]
    if a % b == 0:
        result += ( (m // p[i]) + (m % p[i]) // p[i+1] )
    else:
        result = -1

print(result)
#    2 10000
#    2
#    3
#    -1
```

```python
# 교재 답

n, m = map(int, input().split())

# n 개의 화폐 단위
array = []
for i in range(n):
    array.append(int(input()))
    
# 한 번 계산된 결과를 저장하기 위한 DP table 초기화
d = [10001] * (m + 1) # 인덱스와 숫자를 맞추기 위해 + 1

d[0] = 0
for i in range(n): # 화폐 단위 작은 것부터 
    for j in range(array[i], m + 1): #  화폐 단위(array)마다 합계 금액(m)을 0부터 순회하여 화폐 개수 입력
        if d[j-array[i]] != 10001:
            d[j] = min(d[j], d[j-array[i]] + 1)
            
# 계산된 결과 출력
if d[m] == 10001: # 최종적으로 m원을 만들 방법이 없으면
    print(-1)
else:
    print(d[m])
#    2 15
#    2
#    3
#    5
```
