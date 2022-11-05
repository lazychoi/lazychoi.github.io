---
title: "Dictionary Methods List"
date: 2022-10-07
---

출처: [w3school](https://www.w3schools.com/python/python_ref_dictionary.asp){target=_blank}

## 목록

| 메서드    | 설명                                                             |
| --------- | ---------------------------------------------------------------- |
| clear()   | 모든 요소 삭제. 빈 딕셔너리변수는 남김                           |
| get()     | 지정한 key의 value 가져오기. ==없는 key를 지정해도 오류 미반환== | 
| items()   | (key, value) 쌍 반환.                                            |
| keys()    | 변수 내의 모든 key 반환                                          |
| updates() | 한 개 이상의 요소 추가. 인수는 딕서녀리형 또는 2차원 리스트      |
| values()  | 변수 내의 모든 value 반환                                        |


==주의!!==  

- dict.key(), dict.values(), dict.items() 모두 ==메모리 낭비를 줄이기== 위해 list 아닌 **iterable views**를 반환한다.
- eg. dict_keys([...]), dict_values([...]), dict_items([...])
- 반환값을 반복문을 써서 각 요소 출력 또는 
- 반환값을 리스트 자료형으로 변환해서 사용
