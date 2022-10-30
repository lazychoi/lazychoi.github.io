---
title: 09장 다익스트라(Dijkstra) 최단 경로(Shortest Path) 알고리즘
date: 2022-10-20
---

- jupyter 에서는 stdin 이 제대로 구성되어 있지 않기 때문에 stdin.readline()을 실행하면 입력을 받지 못하고 빈 문자열이 반환됨. input() 사용해야 함

```python
INF = int(1e9) # 무한을 의미하는 값으로 10억 설정

# 노드의 개수, 간선의 개수 입력
# n, m = map(int, input().split())
n, m = 6, 11

# 시작 노드 번호 입력
# start = int(input())
start = 1

# 각 노드에 연결되어 있는 노드 정보 담는 리스트 만들기. 노드 개수 6
graph = [[] for i in range(n + 1)]
# 방문한 적이 있는지 체크하는 목적의 리스트 만들기. 노드 개수 6
visited = [False] * (n + 1)
# 최단 거리 테이블을 모두 무한으로 초기화. 노드 개수 6
distance = [INF] * (n + 1)

# 모든 간선의 정보 입력
# for _ in range(m):
#     a, b, c = map(int, input().split())
#     # a번 노드에서 b번 노드로 가는 비용이 c라는 의미
#     graph[a].append((b,c))
graph = [[], [(2, 2), (3, 5), (4, 1)], [(3, 3), (4, 2)], [(2, 3), (6, 5)], [(3, 3), (5, 1)], [(3, 1), (6, 2)], []]

# 방문하지 않은 노드 중에서 최단 거리가 가장 짧은 노드 번호 반환
def get_smallest_node():
    min_value = INF
    index = 0 # 가장 최단 거리가 짧은 노드(인덱스)
    for i in range(1, n + 1): # 모든 노드 순회
        if distance[i] < min_value and not visited[i]: # 노드의 거리가 min_value보다 작고 방문하지 않은 곳이라면
            min_value = distance[i]   # 노드 거리를 min_value에 저장하여 최소값으로 만듦
            index = i                 # 최단 거리 노드 번호 반환
    return index

# 다익스트라 알고리즘
def dijkstra(start):
    distance[start] = 0
    visited[start] = True
    for j in graph[start]:      # start 노드와 연결된 노드 간의 
        distance[j[0]] = j[1]  # 거리 입력
    
    # 시작 노드를 제외한 전체 n-1 개의 노드 반복
    for _ in range(n - 1):
        # 현재 최단거리가 가장 짧은 노드를 꺼내 방문 처리
        now = get_smallest_node()
        visited[now] = True
        # 현재 노드와 연결된 다른 노드 확인
        for j in graph[now]:
            cost = distance[now] + j[1] # 현재 노드까지의 거리 + 연결된 다른 노드까지의 거리
            # 현재 노드를 거쳐 다른 노드로 가는 거리(cost)가 기존 거리(distance[j[0]])보다 더 짧은 경우
            if cost < distance[j[0]]:
                distance[j[0]] = cost
                
# 다익스트라 알고리즘을 수행
dijkstra(start)

# 모든 노드로 가기 위한 최단 거리를 출력
for i in range(1, n + 1):
    # 도달할 수 없는 경우, 무한(INFINITY)이라고 출력
    if distance[i] == INF:
        print("INFINITY")
    # 도달할 수 있는 경우 거리를 출력
    else:
        print(distance[i])
#    0
#    2
#    3
#    1
#    2
#    4
```

## 우선순위 큐 이용

```python
import heapq

# n, m = map(int, input().split())
# start = int(input())
graph = [[] for i in range(n + 1)]  # 노드 개수
distance = [INF] * (n + 1)
n, m, start = 6, 11, 1

# 모든 간선 정보
graph = [[], [(2,2),(3,5),(4,1)],[(3,3),(4,2)],[(2,3),(6,5)],[(3,3),(5,1)],[(3,1),(6,2)],[]]
# for _ in range(m):
#     a, b, c = map(int, input().split())
#     graph[a].append((b,c))


def dijkstra(start):
    q = []  # 우선순위 큐
    # 시작 노드로 가기 위한 최단 경로는 0으로 설정. 큐에 삽입
    heapq.heappush(q, (0, start))
    distance[start] = 0
    while q:  # 큐가 비어있지 않다면
        # 최단거리가 가장 작은 노드에 대한 정보 꺼내기
        dist, now = heapq.heappop(q)
        # 현재 노드가 이미 처리된 적이 있으면 무시. 저장된 거리가 꺼낸 거리보다 짧은 경우
        if distance[now] < dist:
            continue
        # 현재 노드와 연결된 다른 노드 확인
        for i in graph[now]:
            cost = dist + i[1]  # 기존 거리 + 현재 거리
            # 현재 노드를 거쳐서 다른 노드로 이동하는 거리가 더 짧은 경우
            if cost < distance[i[0]]:
                distance[i[0]] = cost
                heapq.heappush(q, (cost, i[0]))
dijkstra(start)

# 모든 노드로 가는 최단거리 출력
for i in range(1, n + 1):
    if distance[i] == INF:
        print('INFINITY')
    else:
        print(distance[i])
#    0
#    2
#    3
#    1
#    2
#    4
```

## 전보 p262

- 입력: 노드 개수, 간선 개수, 시작 노드
- 입력: 출발 노드, 도착 노드, 소요 시간
- 출력: 메시지 받는 총 노드 개수, 최장 거리의 노드가 메시지 받는데 걸리는 최소 시간

```python
# 입력 구현
INF = int(1e9)
n, m, start = map(int, input().split())

# 간선과 소요 시간 입력
graph = [[] for _ in range(n + 1)]
for _ in range(m):
    x, y, z = map(int, input().split())
    graph[x].append([y, z])
graph
#    3 2 1
#    1 2 4
#    1 3 2
#    [[], [[2, 4], [3, 2]], [], []]
```

```python
# 방문 표시, 거리 
d = [INF] * (n + 1)
d
#    [1000000000, 1000000000, 1000000000, 1000000000]
```

```python
# 시작 노드 거리=0, 방문=True
import heapq

def dijk(start):
    q = []
    heapq.heappush(q, (0, start))
    d[start] = 0
    while q:
        # 가장 짧은 노드 정보 꺼내기
        shortest_d, now_node = heapq.heappop(q)

        if shortest_d > d[now_node]:
            continue
        # 현재 노드와 연결된 다른 노드 확인
        for i in graph[now_node]:
            cost = shortest_d + i[1]
            if cost < d[i[0]]:
                d[i[0]] = cost
                heapq.heappush(q, (cost, i[0]))
    return d

dijk(start)
#    [1000000000, 0, 4, 2]
```

```python
# 출력

# 도달할 수 있는 노드 개수
count = 0

# 도달할 수 있는 노드 중 가장 멀리 있는 노드와의 최단 거리
max_distance = 0
for i in d:
    if i != INF:
        count += 1
        max_distance = max(max_distance, i)

print('노드 개수: ', count - 1) # 시작 노드 제외
print('모두 메시지 받는 데까지 걸린 시간: ', max(d[1:]))
#    노드 개수:  2
#    모두 메시지 받는 데까지 걸린 시간:  4
```
