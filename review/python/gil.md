---
title: GIL(Global Interpreter Lock)
date: 2022-10-07
updated: last-modified
---

참고:

- [쉬운 한글 설명](https://tibetsandfox.tistory.com/43){target=_blank}
- [진지한 한글 설명](https://dgkim5360.tistory.com/entry/understanding-the-global-interpreter-lock-of-cpython){target=_blank} 
- [체계적인 영문 설명 with code](https://realpython.com/python-gil/){target=_blank}

## 정의

다수의 스레드가 동시에 파이썬 바이트 코드를 실행하지 못하게 막는. 일종의 뮤텍스(a mutex (or a lock) that allows only one thread to hold the control of the Python interpreter.)

## 이해를 위한 전제 지식

- thread
- mutex(mutual exclusion)
- race condition
- reference counting(메모리 관리)
- Garbage Collection

## 설명

- 한 시점에 하나의 스레드에만 모든 자원을 할당하고 다른 스레드가 접근하지 못하도록 막는 기능 수행
- GIL이 스레드끼리 공유하는 프로세스의 자원을 이름 그대로 Global 하게 Lock 해버리고 단 하나의 스레드에만 이 자원에 접근하는 것을 허용

## GIL이 야기하는 문제

- CPU-bound, multi-thread 코드를 실행할 때 병목을 일으킬 수 있다.
- 멀티스레드라 하더라도 한 번에 하나의 스레드만 실행
- -> 컨텍스트 전환 비용 발생

## 왜 파이썬에서는 GIL을 쓰는가?

- 파이썬은 모든 객체의 참조 횟수(reference count)를 저장하여, 이것이 0이 되면 GC(Garbage Collector)가 객체를 메모리에서 삭제한다.
- 만약 여러 스레드에서 동시에 한 객체에 접근하면 경쟁 상태(race Condition)가 되어 문제 발생
- 참조 횟수 변수(reference count variable)는 경쟁 상태(race Condition)로부터 보호되어야 한다.
- 경쟁 상태를 막기 위해 한 스레드만 접근하게 함

## race codition에서 발생하는 문제 확인 코드

```python
# 출처: https://dgkim5360.tistory.com/entry/understanding-the-global-interpreter-lock-of-cpython

import threading

x = 0

def foo():
    global x
    for i in range(10000):
        x += 1
    
def bar():
    global x
    for i in range(10000):
        x -= 1
    
t1 = threading.Thread(target=foo)
t2 = threading.Thread(target=bar)
t1.start()
t2.start()
t1.join()
t2.join()

print(x)

```

-> 0이 출력되어야 할 것 같은데, 다른 값이 출력됨
