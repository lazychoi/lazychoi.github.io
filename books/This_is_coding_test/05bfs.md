---
title: 5장 BFS
date: 2022-10-16
---

## 넓이 우선 탐색(BFS, Breath first Search) p143

```python
from collections import deque

# BFS 메서드 정의
def bfs(graph, start, visited):
    
    # 큐 구현을 위해 deque 라이브러리 사용
    queue = deque([start])
    # 현재 노드 방문 처리
    visited[start] = True
    
    while queue:
        # 큐에서 하나의 원소를 뽑아 출력
        v = queue.popleft()
        print(v, end=' ')
        
        # 뽑은 원소와 연결된 아직 방문하지 않은 원소들을 큐에 삽입
        for i in graph[v]:
            if not visited[i]:
                queue.append(i)
                visited[i] = True

graph = [
    [],
    [2, 3, 8],
    [1, 7],
    [1, 4, 5],
    [3, 5],
    [3, 4],
    [7],
    [2, 6, 8],
    [1, 7],
]

visited = [False] * 9

bfs(graph, 1, visited)

# 결과
# 1 2 3 8 7 4 5 6
```

### BFS 실행 추적

```text
pop(1) -> v = 1 -> [2, 3, 8]
    i = 2(visited) -> [2]
    i = 3(visited) -> [2, 3]
    i = 8(visited) -> [2, 3, 8]
pop(2) -> v= 2 -> [1, 7]
    i = 1 -> visited
    i = 7 -> [3, 8, 7]
pop(3) -> v = 3 -> [1, 4, 5]
    i = 1 -> visited
    i = 4 -> [8, 7, 4]
    i = 5 -> [8, 7, 4, 5]
pop(8) -> v = 8 -> [1, 7]
    i = 1 -> visited
    i = 7 -> visited
pop(7) -> v = 7 -> [2, 6, 8]
    i = 2 -> visited
    i = 6 -> [4, 5, 6]
    i = 8 -> visited
pop(4) -> v = 4 -> [3, 5]
    i = 3 -> visited
    i = 5 -> visited
pop(5) -> v = 5 -> [3, 4]
    i = 3 -> visited
    i = 4 -> visited
pop(6) -> v = 6 -> [7]
    i = 7 -> visited
```

### 오류 확인 deque( 1 ) vs deque( [1] )

```python
a = deque(1)
print(a)

# 결과
# ------------------------------------------------------------------
# TypeError                    Traceback (most recent call last)
# Input In [29], in <cell line: 1>()  
# ----> 1 a = deque(1)  
#       2 a
# 
# TypeError: 'int' object is not iterable
```

```python
b = deque([1])
print(b)

# deque([1])
```

## 미로 탈출 p152

```python
from collections import deque

# n, m을 공백으로 구분하여 입력받기
# n, m = map(int, input().split())

# 2차원 리스트 맵 정보 입력받기
# graph = []
# for i in range(n):
#     graph.append(
#         list(map(int, input()))
#     )

n, m = 3, 3
graph = [[1, 1, 0], [0, 1, 0], [0, 1, 1]]

# 이동할 네 방향 정의(상, 하, 좌, 우)
dx = [-1, 1, 0, 0]
dy = [0, 0, -1, 1]

# BFS 구현
def bfs(x, y):
    
    # deque 객체 선언
    queue = deque()
    queue.append((x, y))
    
    # 큐가 빌 때까지 반복
    while queue:
        x, y = queue.popleft()
        
        # 현재 위치에서 상,하,좌,우 확인
        for i in range(4):
            nx = x + dx[i]
            ny = y + dy[i]
            
            # 맵 공간을 벗어나면 무시. 괄호 안은 시작점으로 돌아가는 문제 수정. 수정하지 않아도 정답에는 영향 무
            if nx < 0 or nx >= n or ny < 0 or ny >= m or ( nx == 0 and ny == 0 ):
                continue
            # 벽인 경우 무시
            if graph[nx][ny] == 0:
                continue
            
            # 해당 노드를 처음 방문한 경우에만 최단 거리 기록
            if graph[nx][ny] == 1:
                graph[nx][ny] = graph[x][y] + 1
                queue.append((nx, ny))
                
    # 가장 오른쪽 아래까지의 최단 거리 반환
    return graph[n-1][m-1]   # n, m 행렬의 끝 인덱스는 각각의 크기 - 1

print( bfs(0, 0) )
# 5
```

```python
print(graph)
# [[1, 2, 0], 
#  [0, 3, 0], '
#  [0, 4, 5]]
```

### 미로 탈출 실행 추적

```text
popleft(0,0) -> 상 -> 지도 밖 무시
             -> 하 -> 0 만나 무시
             -> 좌 -> 지도 밖 무시
             -> 우(0,1) -> graph[0][1] = 2 -> [(0, 1)]
popleft(0,1) -> 상 -> 지도 밖 무시
             -> 하(1,1) -> graph[1][1] = 2 -> [(1,1)]
             -> 좌(0,0) -> graph[0][0] = 2 -> [(1,1), (0,0)]
             -> 우 -> 0 만나 무시
popleft(1,1) -> 상 -> 2 만나 무시
             -> 하(2,1) -> graph[2][1] = 3 -> [(0, 0), (2,1)]
             -> 좌 -> 0 만나 무시
             -> 우 -> 0 만나 무시
popleft(0,0) -> 상 -> 지도 밖 무시
             -> 하 -> 0 만나 무시
             -> 좌 -> 지도 밖 무시
             -> 우 -> 2 만나 무시
popleft(2,1) -> 상 -> 2 만나 무시
             -> 하 -> 지도 밖 무시
             -> 좌 -> 0 만나 무시
             -> 우 -> graph[2][2] = 4 -> [(2,2)]
popleft(2,2) -> 상 -> 0 만나 무시
             -> 하 -> 지도 밖 무시
             -> 좌 -> 3 만나 무시
             -> 우 -> 지도 밖 무시
```

이동 가능한 모든 셀, 즉 값이 1인 셀을 방문하여 +1로 바꾼다. 그러면, 이미 방문한 셀을 재방문하지 않게 된다.
