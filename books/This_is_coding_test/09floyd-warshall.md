---
title: 09장 Floyd-Warshall Algorithm p251
date: 2022-10-22
---

- 모든 지점에서 다른 모든 지점까지의 최단 경로 구하는 알고리즘
- 2차원 리스트에 최단 거리 정보 저장
- O(N^3)

```python
INF = int(1e9)  # 무한으로 10억 설정

# 노드, 간선 개수 입력
# n = int(input())
# m = int(input())
n, m = 4, 7

# 2차원 리스트(그래프 표현) 만들고, 모든 값을 무한으로 초기화
# graph = [ [INF] * (n + 1) for _ in range(n + 1)]

# # 자가 자신에서 자기 자신으로 가는 비용 0으로 초기화
# for a in range(1, n + 1):
#     for b in range(1, n + 1):
#         if a == b:
#             graph[a][b] = 0

# # 각 간선에 대한 정보를 입력받아, 그 값으로 초기화
# for _ in range(m):
#     # A에서 B로 가는 비용은 C라고 설정
#     a, b, c = map(int, input().split())
#     graph[a][b] = c

graph = [[1000000000, 1000000000, 1000000000, 1000000000, 1000000000],
         [1000000000, 0, 4, 1000000000, 6],
         [1000000000, 3, 0, 7, 1000000000],
         [1000000000, 5, 1000000000, 0, 4],
         [1000000000, 1000000000, 1000000000, 2, 0]]

# 점화식에 따라 플로이드 워셜 알고리즘 수행
for k in range(1, n + 1):
    for a in range(1, n + 1):
        for b in range(1, n + 1):
                graph[a][b] = min(graph[a][b], graph[a][k] + graph[k][b])

# 수행 결과 출력
for a in range(1, n + 1):
    for b in range(1, n + 1):
        # 도당할 수 없는 경우 INF 출력
        if graph[a][b] == INF:
            print('INFINITY', end=' ')
        else:
            print(graph[a][b], end=' ')
    print()
#    0 4 8 6 
#    3 0 7 9 
#    5 9 0 4 
#    7 11 2 0 
```

## 미래 도시 p259

- 입력 첫째 줄: 노드 개수, 간선 개수
- 입력 둘째 줄 ~ 간선 개수: 서로 연결된 노드
- 마지막 줄: 목적 노드(X), 목적 노드 도착 전에 꼭 들러야 하는 노드(K)

```python
# 입력 받은 간선 정보를 2차원 리스트로 만들기

# 노드, 간선 개수 입력
n, m = map(int, input().split())

INF = int(1e9)
graph = [[INF] * (n+1) for _ in range(n + 1)]

# 자신 -> 자신 비용 0으로 초기화
for i in range(1, n + 1):
    for j in range(1, n + 1):
        if i == j:
            graph[i][j] = 0

# 간선 정보 입력 -> 초기화
# 간선 비용은 모두 1
for _ in range(m):
    a, b = map(int, input().split())
    graph[a][b] = 1 # a -> b
    graph[b][a] = 1 # b -> a


graph

#     5 7
#     1 2
#     1 3
#     1 4
#     2 4
#     3 4
#     3 5
#     4 5
# 
#     [[1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000],
#      [1000000000, 0, 1, 1, 1, 1000000000],
#      [1000000000, 1, 0, 1000000000, 1, 1000000000],
#      [1000000000, 1, 1000000000, 0, 1, 1],
#      [1000000000, 1, 1, 1, 0, 1],
#      [1000000000, 1000000000, 1000000000, 1, 1, 0]]
```

```python
# 목적지, 경유지 입력 받기
x, k = map(int, input().split())
x, k
#    4 5
#
#    (5, 4)
```

```python
# 모든 노드를 경유지로 설정하고
# 각 노드에서 경유지를 거쳐 모든 노드로 가는 거리 계산

for k in range(1, n + 1):
    for i in range(1, n + 1): 
        for j in range(1, n + 1):
            graph[i][j] = min(graph[i][j], graph[i][k] + graph[k][j])
graph
#    [[1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000],
#     [1000000000, 0, 1, 1, 1, 2],
#     [1000000000, 1, 0, 2, 1, 2],
#     [1000000000, 1, 2, 0, 1, 1],
#     [1000000000, 1, 1, 1, 0, 1],
#     [1000000000, 2, 2, 1, 1, 0]]
```

```python
# 수행 결과 출력
print(graph[1][k], graph[k][x])
distance = graph[1][k] + graph[k][x]

# 도달할 수 없는 경우 -1 출력
if distance >= INF:
    print('-1')
else:
    print(distance)
#    2 1
#    3
```
