---
title: str.translate()
date: 2022-10-17
---

문자열을 딕셔너리에 정의한 문자로 바꾼다.

```python
jumper = {'1':'9','2':'8','3':'7','4':'6','5':'0','6':'4','7':'3','8':'2','9':'1','0':'5'}

text = 'Jenny = 867-5309'
print( text.translate(str.maketrans(jumper)) )

# 결과
# Jenny = 243-0751
```
