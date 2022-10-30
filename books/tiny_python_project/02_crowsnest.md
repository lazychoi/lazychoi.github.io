# 2장 문자열 처리
created: 2022-10-10


## 문(statement) vs 표현식(expresstion)

- statement: 반환값이 없음. eg. word = 'narwhal'
- expresstion: True 또는 False 반환. eg. word == 'narwhal'

## if ~ else 문 한 줄에 쓰기

단어의 첫글자가 모음이면 an, 그렇지 않으면 a 할당

`article = 'an' if word[0].lower() in 'aeiou' else 'a'`

```python
#!/usr/bin/env python3
"""
Author : jun <jun@localhost>
Date   : 2022-10-10
Purpose: Crow's Nest
"""

import argparse


def get_args():
    """Get command-line arguments"""

    parser = argparse.ArgumentParser(
        description="Crow's Nest -- choose the correct article",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument("word", help="A word")

    return parser.parse_args()


def main():
    """Make a jazz noise here"""

    args = get_args()
    word = args.word

    # if else문을 한 줄에 쓰기
    article = "an" if word[0].lower() in "aeiou" else "a"
    # print('Ahoy, Captain, {} {} off the larboard bow!'.format(article, word))
    print(f"Ahoy, Captain, {article} {word} off the larboard bow!")


if __name__ == "__main__":
    main()

```