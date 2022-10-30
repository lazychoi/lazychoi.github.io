---
title: 줄번호 출력
date: 2022-10-14
---

[출처](https://louky0714.tistory.com/144){target=_blank}

코드 실행 흐름을 파악하기 위해 종종 print()문을 코드 중간에 넣어 사용한다. 문제는 출력 위치를 나타내기 위해 따옴표 안에 고유한 문자열을 넣어 다른 print()문과 구분하는 게 여간 성가신 일이 아니다. 다음 코드는 호출한 곳의 줄번호를 반환하여 어느 곳에 위치한 print()문인지 쉽게 파악하게 해준다.

```python
def line_info(return_type=None):
    import inspect
    
    # 여기를 호출한 곳의 라인위치(라인번호)를 리턴한다.
    cf = inspect.currentframe()
    return cf.f_back.f_lineno
    

def gcd(a, b):
    if a % b == 0:
        print(a, b, '<----', line_info() )
        return b
    else:
        print(a, b, a%b, '<----', line_info() )
        return gcd(b, a % b)

print(gcd(32, 72))
# 32 72 32 <---- 14
# 72 32 8 <---- 14
# 32 8 <---- 11
# 8

```

여기선 줄번호만 가져오는 코드만 사용했다. 출처에는 호출한 파일과 함수까지 가져오는 코드가 있다.
