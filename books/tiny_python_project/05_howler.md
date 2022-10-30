---
title: 05장 파일 및 STDOUT 사용
date: 2022-10-17
---

문제를 풀지 못했다. 위치 인수와 옵션 인수 존재 유무에 따라 입출력 처리방법이 꼬여 마지막 2개 test를 통과하지 못했다.

- 인자를 반환할 때 인자가 파일명이면 내용을 반환한다는 생각을 전혀 못 했다.
- 위치 인자와 옵션 인자는 순서에 관계 없이 입력해도 된다.
- `sys.stdout` 명령어를 배웠다. 터미널 출력이다.
- 그런데, 저자의 코드도 마지막 테스트는 통과하지 못했다. ??

```python
#!/usr/bin/env python3
"""
Author : Me <me@foo.com>
Date   : today
Purpose: Howler (upper-cases input)
"""

import os, sys
import argparse


# --------------------------------------------------
def get_args():
    """Get command-line arguments"""

    parser = argparse.ArgumentParser(
        description='Howler (upper-cases input)',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)

    parser.add_argument('text',           # 위치 인수는 문자열일 수도 파일명일 수도 있다.
                        metavar='text',
                        type=str,
                        help='Input string or file')

    parser.add_argument('-o',
                        '--outfile',
                        help='Output filename',
                        metavar='str',
                        type=str,
                        default='')

    args = parser.parse_args()

    # args.text가 존재하는 파일명이라면 파일 내용을 반환한다.
    if os.path.isfile(args.text):
        args.text = open(args.text).read().rstrip()

    return args

# --------------------------------------------------
def main():
    """Make a jazz noise here"""

    args = get_args()

    # outfile 인자가 있으면 파일에 쓰고, 그렇지 않으면 화면에 출력한다.
    # 파일에 쓸 때는 대문자로 쓴다.
    out_fh = open(args.outfile, 'wt') if args.outfile else sys.stdout
    out_fh.write(args.text.upper() + '\n')
    out_fh.close()
        
# --------------------------------------------------
if __name__ == '__main__':
    main()
```
