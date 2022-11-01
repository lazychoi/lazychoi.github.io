---
title: 07장 순차 탐색(Sequential Search) p186
date: 2022-10-18
---

- 순차 탐색이란 리스트 안에 있는 특정한 데이터를 찾기 위해 앞에서부터 데이터를 하나씩 차례로 확인하는 방법
- 시간 복잡도 O(N)

```python
# 입력된 단어들 중에 찾는 단어의 위치 반환

def sequential_search(n, target, array):
    for i in range(n):
        if array[i] == target:
            return i + 1 # 현재 위치 반환(인덱스는 0부터 시작하므로 1 더하기)
        
print('생성할 원소 개수를 입력한 다음 한 칸 띄고 찾을 문자열을 입력하세요.')
input_data = input().split()
n = int(input_data[0]) # 원소 개수
target = input_data[1]

print('앞서 적은 원소 개수만큼 문자열을 입력하세요. 띄어쓰기 한 칸으로 구분합니다.')
array = input().split()

# 순차 탐색 수행 결과 출력
print(sequential_search(n, target, array))

```text
    생성할 원소 개수를 입력한 다음 한 칸 띄고 찾을 문자열을 입력하세요.
    5 world
    앞서 적은 원소 개수만큼 문자열을 입력하세요. 띄어쓰기 한 칸으로 구분합니다.
    hello world in our space
    2
```
