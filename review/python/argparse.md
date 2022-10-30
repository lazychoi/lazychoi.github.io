---
title: argparse
date: 2022-10-11
---

출처: tiny python project 부록 pp.457~481  

[argparse 자습서](https://docs.python.org/ko/3/howto/argparse.html){target=_blank}

## 인수 종류

- 위치 인수(positional argument): 인수의 순서와 숫자가 의미 결정
- 명명된 옵션 인수(named option): 대시 하나(-) 또는 두 개(--)로 인수 정의하고 그 뒤에 값을 지정. 기본값을 설정하는 게 좋음.
- 플래그(flag): yes/no, True/False. 

## parser 만들기

```python
import argparse

parser = argparse.ArgumentParser(
    description='Argparse Python script',
    formatter_class=argparse.ArgumentDefaultHelpFormatter
)
```

- parse : 인수로 전달된 텍스트의 구조와 순서에서 특정 의미를 추출하는 처리
- ==명령줄의 모든 인수는 문자열==

## 위치 인수 만들기

```python
parser.add_argument(
    'positional',       # 앞에 대시(-)가 없으면 위치 인수. 이름은 아무 거나
    metavar='str',      # 데이터 타입 힌트. 모든 인수의 기본값은 문자열
    help='A positional argument'  # 인수에 대한 간단한 설명
)
```

## 두 개의 위치 인수가 필요한 경우

```python
parser.add_argument(
    'color',
    metavar='color',
    type=str,
    help='The color of the garment'
)

parser.add_argument(
    'size',
    metavar='size',
    type=int,
    help='The size of the garment'
)
```

## 미리 지정한 값 내에서만 입력: choices

```python
parser.add_argument(
    'color',
    metavar='color',
    type=str,
    help='The color of the garment',
    choices=['red', 'yellow', 'blue']
)

parser.add_argument(
    'size',
    metavar='size',
    type=int,
    help='The size of the garment',
    choices=range(1, 11)
)
```

## 두 숫자 받아 더하기. 두 개의 동일 위치 인수

```python
#!/usr/bin/env python3
"""
Author : playdata <playdata@localhost>
Date   : 2022-10-11
Purpose: Picnic game
"""

import argparse
from secrets import choice

parser = argparse.ArgumentParser(
    description='Argparse Python script',
    formatter_class=argparse.ArgumentDefaultsHelpFormatter
)


# --------------------------------------------------
def get_args():
    '''get args'''

    parser.add_argument(
        'numbers',
        metavar='int',
        nargs=2,       # 인수 2개 입력하라
        type=int,      # 각 값은 정수로 변환될 수 있어야 하며, 그렇지 않으면 오류 처리
        help='numbers',
    )

    return parser.parse_args()


# --------------------------------------------------
def main():
    """Make a jazz noise here"""

    args = get_args()
    n1, n2 = args.numbers
    print(f'{n1} + {n2} = {n1 + n2}')


# --------------------------------------------------
if __name__ == '__main__':
    main()

```

==nargs = 2==, type=int 추가

## 하나 이상의 동일한 위치 인수 입력

```python
#!/usr/bin/env python3
"""
Author : playdata <playdata@localhost>
Date   : 2022-10-11
Purpose: Picnic game
"""

import argparse
from secrets import choice

parser = argparse.ArgumentParser(
    description='Argparse Python script',
    formatter_class=argparse.ArgumentDefaultsHelpFormatter
)


# --------------------------------------------------
def get_args():
    '''get args'''

    parser.add_argument(
        'numbers',
        metavar='int',
        nargs='+',     # 인수 1개 이상 입력하라
        type=int,      # 각 값은 정수로 변환될 수 있어야 하며, 그렇지 않으면 오류 처리
        help='numbers',
    )

    return parser.parse_args()


# --------------------------------------------------
def main():
    """Make a jazz noise here"""

    args = get_args()
    numbers = args.numbers
    print('{} = {}'.format(' + '.join(map(str, numbers)), sum(numbers)))


# --------------------------------------------------
if __name__ == '__main__':
    main()

```

==nargs='+'== : 가변 인수

리스트 안의 모든 숫자를 더하는 식과 결과값 표시:

- `print('{} = {}'.format(' + '.join(map(str, numbers)), sum(numbers)))`

## 옵션 있으면 리스트 정렬, 없으면 입력 순으로

```python
parser.add_argument(
    '-s', 
    '--sorted',
    help='sort items',
    action='store_true'  # 옵션이 지정되면 arg.sorted 값에 True 입력. 지정하지 않으면 False 입력
)

args = parser.parse_args()
if args.sorted:
    items = sorted(args.items)
else:
    items = args.items
```
