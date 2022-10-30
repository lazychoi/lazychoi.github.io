---
title: 06장 퀵 정렬(Quick Sort) 알고리즘
date: 2022-10-16
---

- 가장 많이 사용되는 알고리즘
- 기준값(피벗) 설정 -> 피벗보다 큰 수와 작은 수를 교환한 후 리스트를 반으로 나눔
- 호어 분할(Hoare Partition) 방식
- 리스트의 첫 번째 값을 피벗으로 정한다.
- 왼쪽부터 피벗보다 큰 값을 찾고, 오른쪽부터 피벗보다 작은 값을 찾아 서로 자리를 바꾼다.
- 계속 바꾸기를 진행하다 두 값이 엇갈리는 지점에서 작은 값과 피벗을 교환한다.
- 피벗을 기준으로 왼쪽 리스트와 오른쪽 리스트로 분리된다.(분할Divide, 파티션Partition)
- 리스트 원소가 1개가 될 때까지 각 리스트에 대해 분할 작업을 진행한다.

[애니메이션 설명(영어)](https://www.youtube.com/watch?v=-2VqW516BcI){target=_blank}

```python
array = [7, 5, 9, 0, 3, 1, 6, 2, 4, 8]
print(array,'\n')

def quick_sort(array, start, end):
    if start >= end:    # 원소가 1개일 경우 종료
        return
    pivot = start       # 첫번째 인덱스 = 피벗 인덱스
    left = start + 1    # 우측으로 이동할 인덱스
    right = end         # 좌측으로 이동할 인덱스
    print(f'start={array[start]}({start}), left={array[left]}({left}), right={array[right]}({right})\n')
    
    while left <= right: # left와 right이 엇갈리기 전까지 반복

        # 피벗보다 큰 값을 찾을 때까지 반복. 피벗보다 작으면 인덱스 증가
        # 피벗보다 작은 값은 왼쪽에 남기기 때문에 건너 뛰고, 큰 값은 오른쪽으로 보내기 위해 인덱스 저장
        if left <= end and array[left] <= array[pivot]:
            left += 1

        # 피벗보다 작은 값을 찾을 때까지 반복. 피벗보다 크면 인덱스 감소
        # 피벗보다 작은 값을 왼쪽으로 보내기 위해 찾음. 피벗보다 큰 값은 오른쪽에 남김
        while right > start and array[right] >= array[pivot]:
            right -= 1
            
#         print(f'left={array[left]}({left}), right={array[right]}({right})\n')
        
        if left > right: # 인덱스가 엇갈리면 작은 값과 피벗 교환

            array[right], array[pivot] = array[pivot], array[right]
            print('피벗 교환=>', array, '\n')
        
        else: # 인덱스가 엇갈리지 않았으면 작은 값과 큰 값 교환
        
            array[left], array[right] = array[right], array[left]
            print('교환 후', array, '\n')
    
    # 분할 이후 왼쪽 리스트, 오른쪽 리스트 각각 정렬 수행
    quick_sort(array, start, right-1)
    quick_sort(array, right+1, end)
    
quick_sort(array, 0, len(array)-1) # 0은 피벗, len(array)-1은 마지막 인덱스
print(array)
```

```text
    [7, 5, 9, 0, 3, 1, 6, 2, 4, 8] 
    
    start=7(0), left=5(1), right=8(9)
    
    교환 후 [7, 5, 4, 0, 3, 1, 6, 2, 9, 8] 
    
    교환 후 [7, 5, 4, 2, 3, 1, 6, 0, 9, 8] 
    
    교환 후 [7, 5, 4, 2, 0, 1, 6, 3, 9, 8] 
    
    교환 후 [7, 5, 4, 2, 0, 3, 6, 1, 9, 8] 
    
    교환 후 [7, 5, 4, 2, 0, 3, 1, 6, 9, 8] 
    
    교환 후 [7, 5, 4, 2, 0, 3, 1, 6, 9, 8] 
    
    피벗 교환=> [6, 5, 4, 2, 0, 3, 1, 7, 9, 8] 
    
    start=6(0), left=5(1), right=1(6)
    
    교환 후 [6, 5, 1, 2, 0, 3, 4, 7, 9, 8] 
    
    교환 후 [6, 5, 1, 4, 0, 3, 2, 7, 9, 8] 
    
    교환 후 [6, 5, 1, 4, 2, 3, 0, 7, 9, 8] 
    
    교환 후 [6, 5, 1, 4, 2, 0, 3, 7, 9, 8] 
    
    교환 후 [6, 5, 1, 4, 2, 0, 3, 7, 9, 8] 
    
    피벗 교환=> [3, 5, 1, 4, 2, 0, 6, 7, 9, 8] 
    
    start=3(0), left=5(1), right=0(5)
    
    교환 후 [3, 0, 1, 4, 2, 5, 6, 7, 9, 8] 
    
    교환 후 [3, 0, 2, 4, 1, 5, 6, 7, 9, 8] 
    
    교환 후 [3, 0, 2, 1, 4, 5, 6, 7, 9, 8] 
    
    피벗 교환=> [1, 0, 2, 3, 4, 5, 6, 7, 9, 8] 
    
    start=1(0), left=0(1), right=2(2)
    
    피벗 교환=> [0, 1, 2, 3, 4, 5, 6, 7, 9, 8] 
    
    start=4(4), left=5(5), right=5(5)
    
    피벗 교환=> [0, 1, 2, 3, 4, 5, 6, 7, 9, 8] 
    
    start=9(8), left=8(9), right=8(9)
    
    피벗 교환=> [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] 
    
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
```

```python
array = [1, 5, 2, 4, 3]

def quick_sort(array, start, end):
    if start >= end:
        return
    pivot = start
    left = start + 1
    right = end
    
    while left <= right:
        
        if left <= end and array[left] <= array[pivot]:
            left += 1

        while right > start and array[right] >= array[pivot]:
            right -= 1
        
        if left > right:
            print('교환 전', array)
            print(f'인덱스 교차 left={left}, right={right}')
            array[right], array[pivot] = array[pivot], array[right]
            print('피벗 교환=>', array, '\n')
        
        else:
            print('교환 전', array)
            print(f'left={array[left]}({left}) <=> right={array[right]}({right})')
        
            array[left], array[right] = array[right], array[left]
            print('교환 후', array, '\n')
    
    quick_sort(array, start, right-1)
    quick_sort(array, right+1, end)
    
quick_sort(array, 0, len(array)-1)
print(array)
```

```text
    교환 전 [1, 5, 2, 4, 3]
    인덱스 교차 left=1, right=0
    피벗 교환=> [1, 5, 2, 4, 3] 
    
    교환 전 [1, 5, 2, 4, 3]
    left=4(3) <=> right=3(4)
    교환 후 [1, 5, 2, 3, 4] 
    
    교환 전 [1, 5, 2, 3, 4]
    left=4(4) <=> right=4(4)
    교환 후 [1, 5, 2, 3, 4] 
    
    교환 전 [1, 5, 2, 3, 4]
    인덱스 교차 left=5, right=4
    피벗 교환=> [1, 4, 2, 3, 5] 
    
    교환 전 [1, 4, 2, 3, 5]
    left=3(3) <=> right=3(3)
    교환 후 [1, 4, 2, 3, 5] 
    
    교환 전 [1, 4, 2, 3, 5]
    인덱스 교차 left=4, right=3
    피벗 교환=> [1, 3, 2, 4, 5] 
    
    교환 전 [1, 3, 2, 4, 5]
    인덱스 교차 left=3, right=2
    피벗 교환=> [1, 2, 3, 4, 5] 
    
    [1, 2, 3, 4, 5]


[7, 5, 9, 0, 3, 1, 6, 2, 4, 8]

왼쪽: 7보다 큰 숫자 9 = left
오른쪽: 7보다 작은 숫자 4 = right

[7, 5, 4, 0, 3, 1, 6, 2, 9, 8]
```
