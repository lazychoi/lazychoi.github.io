---
title: 깊은 복사(deep copy) vs 얉은 복사(shallow copy)
created: 2022-10-06
updated: last-modified
---

좋은 코드 실행 시각화 도구: [python tutor](https://pythontutor.com/){target=_blank}

## 얉은 복사(shallow copy)

```python
a = [1,2,3,4]
b = a

print( id(a)==id(b) )

a[0] = 100
print( a, b )
```

![a=1](images/20221006151842.png)

![a=100](images/20221006151956.png)

## 깊은 복사(deep copy)

```python
a = [1,2,3,4]
c = a.copy()

print( id(a)==id(c) ) # False

a[0] = 100
print( a, c )         # [100, 2, 3, 4] [1, 2, 3, 4]
```

![a.copy](images/20221006152404.png)

![a.copy](images/20221006152437.png)

## deep copy "list in list"

```python
x = [[1,2], 3, 4]
y = x.copy()

print( id(x)==id(y), id(x[0])==id(x[0]) ) # False True

x[0][0] = 100
print( x, y ) # [[100, 2], 3, 4] [[100, 2], 3, 4]
```

- 리스트 내의 리스트는 주소 복사

![x.copy](images/20221006151359.png)

위 문제를 해결하려면 for문을 돌려 내부 리스트를 깊은 복사한다.

```ptyhon
z = []
for i in x:
    if type(i) == list:
        z.append(i.copy())
    else:
        z.append(i)

x[0][0] = 200
x, z    # ([[200, 2], 3, 4], [[100, 2], 3, 4])
```
