---
title: 04장 딕셔너리
date: 2022-10-17
---

문제가 어렵지 않았다. 딕셔너리.get('검색할 key', 'key가 없을 때 반환값') 함수와 str.translation(str.maketrans(문자 변환 규칙 딕셔너리)) 함수를 배웠다.

## 내가 짠 코드

```python
#!/usr/bin/env python3
"""
Author : Me <me@foo.com>
Date   : today
Purpose: Jump the Five 
"""

import argparse


# --------------------------------------------------
def get_args():
    """Get command-line arguments"""

    parser = argparse.ArgumentParser(
        description='jump',
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    
    parser.add_argument('text',
                metavar='str',
                help='Input text')
   
    return parser.parse_args()


# --------------------------------------------------
def main():
    """Make a jazz noise here"""
    jumper = {'1':'9','2':'8','3':'7','4':'6','5':'0','6':'4','7':'3','8':'2','9':'1','0':'5'}

    args = get_args()
    new_text = ''
    for char in args.text:
        new_text += jumper.get(char, char)
    print(new_text)

    text = 'Jenny = 867-5309'
    print( text.translate(str.maketrans(jumper)) )

# --------------------------------------------------
if __name__ == '__main__':
    main()
```
