---
title: 10장 서로소 집합(Disjoint Sets) p268
date: 2022-10-23
---

- union-find 자료구조
- union 연산: 2개의 원소가 포함된 집합을 하나의 집합으로 합치는 연산
- find 연산: 특정한 원소가 속한 집합이 어떤 집합인지 알려주는 연산
- 트리 자료구조 이용

## 특정 원소가 속한 집합 찾기(parent = 부모 테이블, x = 노드 번호)

```mermaid
graph RL
  4(4) --> 3(3) --> 2(2) --> 1(1)
  6(6) --> 5(5)
  ```

| 노드 번호 | 1 | 2 | 3 | 4 | 5 | 6 |
|-|-|-|-|-|-|-|
| 부모 | 1 | 1 | 2 | 1 | 5 | 5 |

```python
def find_parent(parent, x):

    # 루트 노드가 아니면, 루트 노드를 찾을 때까지(원소가 자신을 부모로 가질 때까지) 재귀적으로 호출
    if parent[x] != x:   # 부모 테이블 인덱스가 자기 자신을 부모로 가지지 않으면 
        return find_parent(parent, parent[x])  # 부모의 노드 번호를 인자로 입력
    
    return x
```

### 두 원소가 속한 집합 합치기

부모 번호가 작은 쪽인 부모가 된다.

```python
def union_parent(parent, a, b): 
    
    a = find_parent(parent, a) # 부모 노드 찾기
    b = find_parent(parent, b) # 부모 노드 찾기
    
    # 부모 번호가 작은 쪽이 상대방의 부모가 된다
    if a < b:
        parent[b] = a
    else:
        parent[a] = b
```

### 노드 개수와 간선(union 연산) 개수 입력 받아 부모 테이블 만들기

```python
v, e = map(int, input().split())
parent = [0] * (v + 1)   # 부모 테이블을 0으로 초기화

for i in range(1, v + 1):
    parent[i] = i  # 부모 테이블을 자기 자신으로 초기화
```

### union 연산 수행할 값 입력

1 4, 2 3, 2 4, 5 6

```python
for i in range(e):
    a, b = map(int, input().split())
    union_parent(parent, a, b)

parent
```

> [0, 1, 1, 2, 1, 5, 5]

### 각 원소가 속한 집합 출력

```python
print('각 원소가 속한 집합: ', end=' ')
for i in range(1, v + 1):
    print(find_parent(parent, i), end=' ')
print()
```

> 각 원소가 속한 집합:  1 1 1 1 5 5

### 부모 테이블 내용 출력

```python
print('부모 테이블: ', end=' ')
for i in range(1, v + 1):
    print(parent[i], end=' ')
```

> 부모 테이블:  1 1 2 1 5 5
