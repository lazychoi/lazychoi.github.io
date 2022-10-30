---
title: "03장 Greedy 알고리즘"
date: "2022-10-10"
---

[python tutor](https://pythontutor.com/render.html#code=n%20%3D%201260%0Acount%20%3D%200%0A%0Acoin_types%20%3D%20%5B500,100,50,10%5D%0A%0Afor%20coin%20in%20coin_types%3A%0A%20%20%20%20count%20%2B%3D%20n%20//%20coin%0A%20%20%20%20n%20%25%3D%20coin%0A%20%20%20%20%0Aprint%28count%29&cumulative=false&curInstr=6&heapPrimitives=nevernest&mode=display&origin=opt-frontend.js&py=3&rawInputLstJSON=%5B%5D&textReferences=false){target=_blank}

- n: 거스름돈, count: 동전 개수
- 가장 큰 돈부터 내림차순으로 coin_types 리스트 만듦. 왜냐면, 거스름돈을 줄 때 큰 돈부터 세기 때문.
- '//' 연산자는 몫 반환
- '%' 연자자는 나머지 반환

```python
n = 1260
count = 0

coin_types = [500, 100, 50, 10]
for coin in coin_types:
    count += n // coin
    n %= coin
    
print(count)
#    6
```

### 큰 수의 법칙 p.92

```python
# 내가 푼 것 => 틀림
# 나누어 떨어지지 않을 때를 고려 못 함

n, m, k = map(int, input().split())
x = list(map(int, input().split()))
# n = 5
# m = 8
# k = 3
# x = [2,4,5,4,6]
result = 0

x.sort(reverse=True)
for _ in range(m//k):
    result += x[0] * k
    result += x[1]

print(result)
#    5 9 3
#    2 4 5 4 6
#    69
```

```python
# 교재 풀이

n, m, k = map(int, input().split())
data = list(map(int, input().split()))

data.sort()            # 오름차순 정렬
first = data[n-1]      # 가장 큰 수 = 마지막 인덱스
second = data[n-2]     # 두 번째로 큰 수

count = int(m / (k+1)) * k   # 가장 큰 수가 곱해지는 횟수
count += m % (k+1)           # k+1로 나누어 떨어지지 않을 때 나머지 만큼 큰 수가 더해짐

result = 0
result += count * first         # 큰 수가 더해짐
result += (m - count) * second  # 큰 수가 더해지는 횟수에서 남은 만큼 두 번째 큰 수가 더해짐 

print(result)
#    5 9 3
#    2 4 5 4 6
#    52
```

### 숫자 카드 게임 p96

```python
# 입력 코드(me)

n, m = map(int, input().split())
list2d = []
for _ in range(n):
    temp = list(map(int, input().split()))
    list2d.append(temp)
print(list2d)
#    2 4
#    7 3 1 8
#    3 3 3 4
#    [[7, 3, 1, 8], [3, 3, 3, 4]]
```

```python
# min() 함수는 내부 리스트 첫 번째 요소로 크기 비교

x = [[3, 1, 2], [4, 1, 4], [2, 2, 2]]
print(min(x))
y = [[7,3,1,8],[3,3,3,4], [10,10,1,1]]
print(min(y))
#    [2, 2, 2]
#    [3, 3, 3, 4]
```

```python
# 내부 리스트의 최소값을 비교해서 가장 큰 내부 리스트 선택하는 코드를 짜야 할 듯
# -> 내부 리스트를 소트하면 가장 작은 값이 첫 번째 요소로 온다.
# -> max() -> 가장 큰 값 출력

for i in x:
    i.sort()

print(max(x))
#    [2, 2, 2]
```

```python
# 최종 코드(me)

n, m = map(int, input().split())
list2d = []
for _ in range(n):
    temp = list(map(int, input().split()))
    list2d.append(temp)

for i in list2d :
    i.sort()

print(max(list2d)[0])
#    3 3
#    3 1 2 
#    4 1 4
#     2 2 2
#    2
```

```python
# 교재 min() 이용 답안

n, m = map(int, input().split())

result = 0

for i in range(n):
    data = list(map(int, input().split()))
    min_value = min(data)
    result = max(result, min_value)
print(result)
#    3 3
#    3 1 2
#    4 1 4
#    2 2 2
#    2
```

```python
# 교재 2중 반복문 이용 답안

n, m = map(int, input().split())

result = 0

for i in range(n):
    data = list(map(int, input().split()))
    min_value = 10001
    for a in data:
        min_value = min(min_value, a)
    result = max(result, min_value)
    
print(result)
#    3 3
#    3 1 2
#    4 1 4
#    2 2 2
#    2
```

### 1이 될 때까지 p99

```python
# 내가 푼 코드

n, k = map(int, input().split())
count = 0

import time

start = time.time()

while n > 1:
    if n % k == 0:
        n = n / k
        count += 1
    else:
        n -= 1
        count += 1
        
end = time.time()

print(count)
print(end - start)
#    123456789 17
#    42
#    0.00013494491577148438
```

```python
# 교재 답

n, k = map(int, input().split())
result = 0

import time
start = time.time()

while True:
    # (n == k로 나누어떨어지는 수)가 될 때까지 1씩 빼기
    target = (n // k) * k       # n보다 작은 수 중에 k로 나누어 떨어지는 가장 큰 수
    result += (n - target)      # n에서 target에 도달할 때까지 -1을 뺀 횟수
    n = target
    # n이 k보다 적을 때(더 이상 나눌 수 없을 때) 반복문 탈출
    if n < k:
        break
    # k로 나누기
    result += 1
    n //= k
    
# 마지막으로 남은 수에 대해 1씩 빼기
result += (n - 1)

end = time.time()

print(result)
print(end-start)
#    123456789 17
#    42
#    0.0002512931823730469
```
