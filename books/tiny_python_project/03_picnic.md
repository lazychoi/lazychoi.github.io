---
title: "03장 리스트"
date: 2022-10-11
---

## 요구 사항

```bash
$ ./picnic.py chips
You are bringing chips.

$ ./picnic.py "potato chips" chips 
You are bringing potato chips and chips.

$ ./picnic.py "potato chips" chips soda cupcakes
You are bringing potato chips, chips, soda, and cupcakes.

$ ./picnic.py --sorted salad soda cupcakes 
You are bringing cupcakes, salad, and soda.
```

- 한 단어 입력하면 그대로 출력
- 두 단어 입력하면 사이에 and 추가
- 세 단어 이상 입력하면 사이에 쉼표 추가하고, 마지막에는 and도 추가
- `--sorted` 또는 `-s` 를 입력하면 정렬한 뒤 출력

argparse 정리 문서: [argparse](../../review/python/argparse.md)

==내가 짠 코드==

```python
#!/usr/bin/env python3
"""
Author : playdata <playdata@localhost>
Date   : 2022-10-11
Purpose: Picnic game
"""

import argparse

parser = argparse.ArgumentParser(
    description="Argparse Python script",
    formatter_class=argparse.ArgumentDefaultsHelpFormatter,
)


# --------------------------------------------------
def get_args():
    """get args"""

    parser.add_argument(
        "items",
        metavar="str",
        nargs="+",  # 인수 1개 이상 입력하라
        type=str,  # 각 값은 정수로 변환될 수 있어야 하며, 그렇지 않으면 오류 처리
        help="item(s) you want to bring",
    )

    parser.add_argument(
        "-s",
        "--sorted",
        help="sort items",
        action="store_true",  # 옵션이 지정되면 arg.sorted 값에 True 입력
    )

    return parser.parse_args()


# --------------------------------------------------
def main():
    """Make a jazz noise here"""


args = get_args()
if args.sorted:
    items = sorted(args.items)
else:
    items = args.items

    if len(items) == 1:
        print(f"You are bringing {items[0]}.")
    elif len(items) == 2:
        items = " and ".join(items)
        print(f"You are bringing {items}.")
    else:
        items[-1] = "and " + items[-1]
        items = ", ".join(items)
        print(f"You are bringing {items}.")


# --------------------------------------------------
if __name__ == "__main__":
    main()

```

==교재 코드==

```python
#!/usr/bin/env python3
"""Picnic game"""

import argparse


# 파이썬에서는 함수 순서가 중요하지 않다. 단지 읽는 사람을 배려해서 가장 앞에 놓는다.
def get_args():
    """Get command-line arguments"""

    parser = argparse.ArgumentParser(
        description='Picnic game',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    parser.add_argument('item',
                        metavar='str',
                        nargs='+',     # 하나 이상의 위치 인수(문자열)을 받는다
                        help='Item(s) to bring')

    parser.add_argument('-s',          # 옵션 인수(축약형) 
                        '--sorted',    # 옵션 인수
                        action='store_true',   # 옵션이 있으면 True
                        help='Sort the items')

    return parser.parse_args()


# 프로그램 시작 위치
def main():
    """Make a jazz noise here"""

    args = get_args()
    items = args.item   # args에 있는 item 변수를 items에 저장
    num = len(items)    # 리스트에 포함된 아이템 개수를 가져온다. nargs='+'를 사용했으므로 0개인 경우는 없다.

    if args.sorted:     # args.sorted가 True 이면
        items.sort()    # 아이템 정렬한다. 원본 변환. 반환값 없음

    bringing = ''       # 가져올 아이템을 저장한 변수를 빈 문자열로 초기화
    if num == 1:
        bringing = items[0]
    elif num == 2:
        bringing = ' and '.join(items)
    else:
        items[-1] = 'and ' + items[-1]
        bringing = ', '.join(items)

    print('You are bringing {}.'.format(bringing))


# --------------------------------------------------
if __name__ == '__main__': # 여기서 main 네임스페이스에 있는지 확인해서 main() 함수 실행.
    main()

```
